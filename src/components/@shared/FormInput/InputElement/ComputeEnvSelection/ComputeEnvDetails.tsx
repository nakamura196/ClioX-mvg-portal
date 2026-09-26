import styles from './ComputeEnvDetails.module.css'
import CPU from '@images/cpu.svg'
import GPU from '@images/gpu.svg'
import ComputeFootprint from '@shared/ComputeFootprint'

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.row}>
      <span className={styles.value}>{value}</span>
      {` ${label}`}
    </div>
  )
}

export default function ComputeEnvDetails({
  computeEnv
}: {
  computeEnv: ComputeEnvironmentExtended
}) {
  const {
    id,
    desc,
    description,
    cpuNumber,
    cpuType,
    gpuNumber,
    gpuType,
    ramGB,
    diskGB,
    currentJobs,
    maxJobs,
    maxJobDuration
  } = computeEnv

  // 【重要】Ocean Node 3.2.0 は cpuNumber / ramGB / diskGB / gpuNumber を返さない。
  // 代わりに resources: [{id:'cpu'|'ram'|'disk'|'gpu', max, total}] を返す。
  // 旧フィールドだけを見ていると、画面が "N/A" だらけになり、
  // GPU 環境なのに "CPU Cluster" と表示される(2026-08-12 実測)。
  const res = (computeEnv as any).resources as
    | { id: string; max?: number; total?: number }[]
    | undefined
  const resMax = (id: string) => res?.find((r) => r.id === id)?.max
  const cpu = cpuNumber ?? resMax('cpu')
  const ram = ramGB ?? resMax('ram')
  const disk = diskGB ?? resMax('disk')
  const gpu = gpuNumber ?? resMax('gpu')
  // 実行中ジョブ数と上限も 3.2.0 では別名になる。
  // 実行中は runningJobs、上限は free.maxJobs（無償枠）に入る。
  // 旧名 currentJobs / maxJobs だけを見ていると "N/A/N/A" になる（2026-08-12 実測）。
  const running = currentJobs ?? (computeEnv as any).runningJobs
  const maxJobsResolved = maxJobs ?? (computeEnv as any).free?.maxJobs

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          {/* 3.2.0 は description、3.1.3 は desc。両方見ないと id(ハッシュ)が出る。 */}
          <h4 className={styles.title}>{description || desc || id}</h4>
        </div>
        {gpu > 0 ? <GPU /> : <CPU />}
      </div>

      <div className={styles.clusterDetails}>
        <p className={styles.title}>{`${gpu > 0 ? 'GPU' : 'CPU'} Cluster`}</p>
        <p>
          {gpu > 0 && gpuType
            ? gpuType
            : cpu > 0 && cpuType
            ? cpuType
            : gpu > 0
            ? 'GPU'
            : 'CPU'}
        </p>
      </div>
      <div className={styles.details}>
        {/* 【重要】ここで cpuNumber / ramGB / diskGB を直接見てはいけない。
            Ocean Node 3.2.0 はそれらを返さないので、必ず N/A になる。
            上で resources から補完した cpu / ram / disk / gpu を使う。
            （旧実装の `${x || 'N/A'}${x && 'GB'}` は x が falsy のとき
              undefined を連結し、画面に "N/Aundefined" が出る問題もあった） */}
        <Row
          label={gpu > 0 ? 'GPU' : 'cores'}
          value={gpu > 0 ? gpu : cpu ?? '—'}
        />
        <Row label="cores" value={cpu ?? '—'} />
        <Row label="RAM" value={ram ? `${ram}GB` : '—'} />
        <Row label="Storage" value={disk ? `${disk}GB` : '—'} />
      </div>
      <div className={styles.footer}>
        <Row
          label="running jobs"
          value={`${running ?? '—'}/${maxJobsResolved ?? '—'}`}
        />
      </div>

      {/*
        [prototype] 所在地・費用・カーボンフットプリント。
        maxJobDuration を占有時間の上限見積もりとして使う(実績時間ではない)。
      */}
      <ComputeFootprint
        computeEnv={computeEnv}
        durationSeconds={maxJobDuration}
      />
    </div>
  )
}
