import { useState, type InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  wrapperClassName?: string
}

function EyeIcon({ hidden }: { hidden: boolean }): JSX.Element {
  if (hidden) {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path
          d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5-8-5.5-8-5.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path
        d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5-8-5.5-8-5.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 17 17 3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function PasswordInput({ wrapperClassName, className, ...inputProps }: Props): JSX.Element {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <input {...inputProps} type={visible ? 'text' : 'password'} className={`${className ?? ''} pr-9`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        aria-label={visible ? 'パスワードを隠す' : 'パスワードを表示'}
      >
        <EyeIcon hidden={!visible} />
      </button>
    </div>
  )
}
