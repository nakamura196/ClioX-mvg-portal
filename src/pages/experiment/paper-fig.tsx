import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import { Field, Formik, Form } from 'formik'
import Page from '@shared/Page'
import Input from '@shared/FormInput'
import Button from '@shared/atoms/Button'
import Markdown from '@shared/Markdown'
import contentStyles from '../../components/Asset/AssetContent/index.module.css'
import actionStyles from '../../components/Asset/AssetActions/index.module.css'
import trialsJson from '../../../content/experiment/trials.json'
import { TrialsFile } from '@utils/experiment'

// [prototype] 論文の図 1 の見本（2026-11-04）。本番には配らない。
// 資料ページと同じ枠（ヘッダー・資料の欄・右の「計算」の箱）に、
// 見本の計算環境 4 つを並べる。値は /experiment の課題 t4 と同じダミー。
// ?env=a|b|c|d で選んだ状態にする（既定は a = Granite Cloud、図 2 と同じ）。
const TRIAL = 't4'
const ORDER = ['b', 'c', 'a', 'd']

const trial = (trialsJson as unknown as TrialsFile).trials.find(
  (t) => t.id === TRIAL
)!

const envs = ORDER.map((id) => {
  const o = trial.options.find((x) => x.id === id)!
  return {
    id: `paper-fig-${TRIAL}${id}`,
    description: o.provider,
    gpuNumber: 1,
    maxJobDuration: 3600,
    priceMin: 0,
    trialOption: o,
    sample: `${TRIAL}${id}`
  }
})

const algorithms = [
  {
    did: 'did:op:paper-fig-embeddings',
    name: 'Text embeddings for PDF reports',
    price: 0,
    tokenSymbol: 'EURAU',
    checked: true,
    symbol: 'ALGO',
    isAccountIdWhitelisted: true
  }
]

const DESCRIPTION = `Annual reports of a municipal archive, 2010–2024 (500 PDF files, digitised).

The files stay with the archive. Researchers can run approved analyses on them through Clio-X without downloading the files.

*Example record for illustration.*`

export default function PagePaperFig(): ReactElement {
  const router = useRouter()
  const pick =
    typeof router.query.env === 'string' ? router.query.env : ORDER[2]
  const selected = `paper-fig-${TRIAL}${pick}`

  return (
    <Page title="Municipal annual reports, 2010–2024" uri={router.asPath}>
      <article className={contentStyles.grid}>
        <div>
          <div className={contentStyles.content}>
            <Markdown text={DESCRIPTION} />
          </div>
        </div>
        <div>
          <div className={actionStyles.actions}>
            <Formik
              initialValues={{
                computeEnv: selected,
                algorithm: algorithms[0].did
              }}
              enableReinitialize
              onSubmit={() => undefined}
            >
              {({ values }) => (
                <Form>
                  <Field
                    name="computeEnv"
                    label="Select a Compute Environment"
                    type="computeEnvSelection"
                    component={Input}
                    options={envs}
                    selected={values.computeEnv}
                  />
                  <Field
                    name="algorithm"
                    label="Select an algorithm to start a compute job"
                    type="assetSelection"
                    component={Input}
                    options={algorithms}
                    selected={values.algorithm}
                  />
                  <Button style="primary" disabled type="button">
                    Buy Compute Job
                  </Button>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </article>
    </Page>
  )
}
