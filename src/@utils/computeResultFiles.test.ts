import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { TextDecoder } from 'util'
import { untar } from './computeResultFiles'

// jsdom には TextDecoder が無い
global.TextDecoder = TextDecoder as typeof global.TextDecoder

// Ocean Node 4.x の outputs.tar と同じ形（"outputs/<名前>"）を tar コマンドで作る
function makeArchive(): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), 'untar-'))
  mkdirSync(join(dir, 'outputs'))
  writeFileSync(join(dir, 'outputs', 'wordcloud.json'), '[{"value":"a"}]')
  writeFileSync(join(dir, 'outputs', 'date_distribution.csv'), 'time,count\n')
  const long = 'x'.repeat(120) + '.json'
  writeFileSync(join(dir, 'outputs', long), '{}')
  const out = join(dir, 'outputs.tar')
  // macOS の tar が ._ で始まる付属ファイルを足さないように
  execFileSync('tar', ['-cf', out, '-C', dir, 'outputs'], {
    env: { ...process.env, COPYFILE_DISABLE: '1' }
  })
  return new Uint8Array(readFileSync(out))
}

describe('untar', () => {
  it('reads regular files, including long names', () => {
    const files = untar(makeArchive())
    const names = files.map((f) => f.name.split('/').pop()).sort()
    expect(names).toEqual([
      'date_distribution.csv',
      'wordcloud.json',
      'x'.repeat(120) + '.json'
    ])
    const wc = files.find((f) => f.name.endsWith('wordcloud.json'))
    expect(new TextDecoder().decode(wc.data)).toBe('[{"value":"a"}]')
  })
})
