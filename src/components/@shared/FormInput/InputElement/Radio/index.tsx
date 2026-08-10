import { InputHTMLAttributes, ReactElement } from 'react'
import classNames from 'classnames/bind'
import styles from './index.module.css'
import Option from './Option'

const cx = classNames.bind(styles)

interface InputRadioProps extends InputHTMLAttributes<HTMLInputElement> {
  options: string[]
  inputSize?: string
  prefixes?: string[]
  postfixes?: string[]
  actions?: string[]
}

export default function InputRadio({
  options,
  inputSize,
  prefixes,
  postfixes,
  actions,
  ...props
}: InputRadioProps): ReactElement {
  return (
    <div className={styles.radioGroup}>
      {options &&
        (options as string[]).map((option: string, index: number) => {
          // Derive the id from the field name rather than the option text: the
          // label is translated, and slugify() drops non-latin scripts, which
          // would collapse every Japanese option to the same empty id.
          const id = `${props.name || 'option'}-${index}`

          return (
            <div className={styles.radioWrap} key={index}>
              <input {...props} className={styles[props.type]} id={id} />
              <label
                className={cx({
                  [styles.radioLabel]: true,
                  [inputSize]: inputSize
                })}
                htmlFor={id}
              >
                <Option
                  option={option}
                  prefix={prefixes?.[index]}
                  postfix={postfixes?.[index]}
                  action={actions?.[index]}
                />
              </label>
            </div>
          )
        })}
    </div>
  )
}
