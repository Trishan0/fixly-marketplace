import React from 'react'
import { Button } from './UI'

// Footer for paged lists: shows how much is visible and fetches the next page.
export function LoadMore({ shown, total, hasNextPage, isFetchingNextPage, onLoadMore, noun = 'results' }) {
  if (!shown) return null
  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center">
      <p className="text-sm text-slate-500" aria-live="polite">
        {typeof total === 'number' ? `Showing ${shown.toLocaleString('en-LK')} of ${total.toLocaleString('en-LK')} ${noun}` : `Showing ${shown.toLocaleString('en-LK')} ${noun}`}
      </p>
      {hasNextPage && (
        <Button variant="outline" onClick={onLoadMore} loading={isFetchingNextPage}>
          Load more
        </Button>
      )}
    </div>
  )
}
