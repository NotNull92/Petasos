import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ErrorBoundaryProps = {
  children: ReactNode
  className?: string
  title?: string
  description?: string
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error', error, errorInfo)
  }

  reloadPage() {
    if (typeof window === 'undefined') return
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const title = this.props.title ?? '문제가 발생했습니다'
    const description =
      this.props.description ??
      '예기치 않은 오류가 발생했습니다. 다시 로드해 보세요.'

    return (
      <div
        className={cn(
          'flex h-full min-h-0 items-center justify-center bg-primary-50 p-6',
          this.props.className,
        )}
      >
        <div className="w-full max-w-md rounded-xl border border-primary-200 bg-primary-100 p-6 text-center shadow-sm">
          <h2 className="text-balance text-xl font-medium text-primary-900">
            {title}
          </h2>
          <p className="mt-2 text-pretty text-sm text-primary-700">
            {description}
          </p>
          {this.state.error ? (
            <pre className="mt-3 max-h-32 overflow-auto rounded bg-red-50 p-2 text-left text-[10px] text-red-800">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
            </pre>
          ) : null}
          <div className="mt-5 flex justify-center">
            <Button onClick={() => this.reloadPage()}>다시 로드</Button>
          </div>
        </div>
      </div>
    )
  }
}
