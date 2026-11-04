import { describe, expect, it } from 'vitest'
import { groupPrsByTask, type RefPr } from './deploy-refs'

const pr = (id: string, tasks: string[], no_task = false): RefPr => ({ id, url: `https://git.example.com/pr/${id}`, number: Number(id), description: null, no_task, tasks })

describe('groupPrsByTask', () => {
  it('liga cada task aos seus PRs e repete o PR que cobre mais de uma task', () => {
    const g = groupPrsByTask(['A-1', 'A-2', 'A-3'], [pr('1', ['A-1']), pr('2', ['A-2']), pr('3', ['A-2', 'A-3'])])
    expect(g.byTask.map((r) => [r.task, r.prs.map((p) => p.id)])).toEqual([
      ['A-1', ['1']],
      ['A-2', ['2', '3']],
      ['A-3', ['3']],
    ])
    expect(g.noTask).toEqual([])
    expect(g.pending).toEqual([])
  })

  it('mantém a task sem PR com lista vazia', () => {
    expect(groupPrsByTask(['A-1'], []).byTask).toEqual([{ task: 'A-1', prs: [] }])
  })

  it('separa PR sem task de PR a vincular', () => {
    const g = groupPrsByTask(['A-1'], [pr('1', ['A-1']), pr('2', [], true), pr('3', [])])
    expect(g.noTask.map((p) => p.id)).toEqual(['2'])
    expect(g.pending.map((p) => p.id)).toEqual(['3'])
  })

  it('PR ligado só a task de fora do deploy não some: vai para a vincular', () => {
    const g = groupPrsByTask(['A-1'], [pr('1', ['B-9'])])
    expect(g.byTask[0].prs).toEqual([])
    expect(g.pending.map((p) => p.id)).toEqual(['1'])
  })
})
