import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import * as Yup from 'yup'
import useLocaleContent from '../../i18n/useLocaleContent'
import { getValidationSchema } from './_validation'
import formEn from '../../../content/publish/form.json'
import formJa from '../../../content/publish/form.ja.json'
import feedbackEn from '../../../content/publish/feedback.json'
import feedbackJa from '../../../content/publish/feedback.ja.json'
import { getWizardStepTitles, wizardStepComponents } from './_constants'
import { PublishFeedback, StepContent } from './_types'

/**
 * The publish wizard's steps, with titles in the active locale.
 *
 * `wizardSteps` in ./_constants is a module-level constant, so its titles are
 * fixed to English at import time. This hook keeps that structure (step number
 * and component, neither of which depends on locale) and re-attaches titles
 * read through `useLocaleContent`, so `/ja/publish/*` gets Japanese ones.
 */
export function usePublishWizardSteps(): StepContent[] {
  const form = useLocaleContent(formEn, formJa)

  return useMemo(() => {
    const titles = getWizardStepTitles(form)
    return wizardStepComponents.map((step, index) => ({
      ...step,
      title: titles[index]
    }))
  }, [form])
}

/**
 * Initial state of the step 6 publish feedback list, in the active locale.
 *
 * `content/publish/feedback.ja.json` has existed and been fully translated for
 * a while, but nothing read it: ./_constants imported only the English
 * `feedback.json` at module scope, so the three publishing steps stayed English
 * even on `/ja`.
 */
export function useInitialPublishFeedback(): PublishFeedback {
  return useLocaleContent<PublishFeedback>(feedbackEn, feedbackJa)
}

/**
 * The publish form's Yup schema, with validation messages in the active locale.
 *
 * Yup resolves messages at schema-construction time, so the module-level
 * `validationSchema` export is permanently English; rebuilding it here per
 * locale is what gets Japanese text into e.g. the price field's error bubble.
 */
export function usePublishValidationSchema(): Yup.SchemaOf<any> {
  const { t } = useTranslation('common')
  return useMemo(() => getValidationSchema(t), [t])
}

export default usePublishWizardSteps
