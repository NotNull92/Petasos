import { Search01Icon } from '@hugeicons/core-free-icons'
import { SearchResultItem } from './search-result-item'
import type { SearchResultItemData } from './search-result-item'
import { EmptyState } from '@/components/empty-state'

type SearchResultsProps = {
  query: string
  results: Array<SearchResultItemData>
  selectedIndex: number
  onHoverIndex: (index: number) => void
  onSelectIndex: (index: number) => void
}

export function SearchResults({
  query,
  results,
  selectedIndex,
  onHoverIndex,
  onSelectIndex,
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <EmptyState
        icon={Search01Icon as any}
        title="검색 결과 없음"
        description={
          query ? `다른 검색어를 시도해 보세요` : '검색어를 입력하세요'
        }
      />
    )
  }

  return (
    <div className="space-y-1.5">
      {results.map((result, index) => (
        <SearchResultItem
          key={result.id}
          item={result}
          selected={index === selectedIndex}
          query={query}
          shortcut={index < 9 ? index + 1 : undefined}
          onHover={() => onHoverIndex(index)}
          onSelect={() => onSelectIndex(index)}
        />
      ))}
    </div>
  )
}

export type { SearchResultItemData }
