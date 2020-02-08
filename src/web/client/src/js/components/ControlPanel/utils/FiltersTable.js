import React from 'react'
import PaginatedTable from './PaginatedTable'
import { Button, Icon } from 'semantic-ui-react'

const filtersTableSearchFunc = (data, search) => data.type.toLowerCase().includes(search) || data.term.toLowerCase().includes(search)

function FiltersTable (props) {
  const { filters, removeFilter, inProgress } = props
  const filtersArray = []
  for (const filterType in filters) {
    const filterTerms = filters[filterType]
    if (Array.isArray(filterTerms)) {
      for (const filterTerm of filterTerms) {
        filtersArray.push({ type: filterType, term: filterTerm })
      }
    } else {
      // Regex
      filtersArray.push({ type: filterType, term: filterTerms })
    }
  }

  const filtersTableRowFunc = data => (
    <PaginatedTable.Row key={data.term}>
      <PaginatedTable.Cell>{data.term}</PaginatedTable.Cell>
      <PaginatedTable.Cell collapsing>{data.type}</PaginatedTable.Cell>
      <PaginatedTable.Cell collapsing>{data.term.startsWith('!') ? <Icon name='check' color='green' /> : null}</PaginatedTable.Cell>
      <PaginatedTable.Cell collapsing>{data.term.startsWith('!~') || data.term.startsWith('~') ? <Icon name='check' color='green' /> : null}</PaginatedTable.Cell>
      <PaginatedTable.Cell collapsing>
        <Button fluid icon='trash' basic color='red' disabled={inProgress} onClick={e => removeFilter(data.type, data.term)} />
      </PaginatedTable.Cell>
    </PaginatedTable.Row>
  )

  return (
      <PaginatedTable.Table
        compact
        unstackable
        items={filtersArray}
        headers={['Filter', 'Category', 'Negated?', 'Broad?', 'Delete']}
        itemFunc={filtersTableRowFunc}
        searchFunc={filtersTableSearchFunc}
      />
  )
}

export default FiltersTable
