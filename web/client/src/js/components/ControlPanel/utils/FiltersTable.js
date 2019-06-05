import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import PaginatedTable from './PaginatedTable'
import { Button, Icon } from 'semantic-ui-react'
import axios from 'axios'
import toast from './toast'

const mapStateToProps = state => {
  return {
    csrfToken: state.csrfToken
  }
}

const filtersTableSearchFunc = (data, search) => data.type.toLowerCase().includes(search) || data.term.toLowerCase().includes(search)

class FiltersTable extends Component {
  constructor () {
    super()
    this.state = {
      addFilterType: 'title',
      addFilterTerm: '',
      classificationsArticleProperty: ''
    }
  }

  removeFilter = (type, term) => {
    const { removeApiUrl, csrfToken } = this.props
    const payload = { type, term }
    this.setState({ removing: payload })
    axios.delete(removeApiUrl, { data: payload, headers: { 'CSRF-Token': csrfToken } })
    .then(() => {
      toast.success(`Removed filter ${term} from ${type}`)
      this.setState({ removing: null })
    }).catch(err => {
      this.setState({ removing: null })
      if (err.response && err.response.status === 304) return toast.success('No changes detected')
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to remove filter<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  render () {
    const { filters } = this.props
    const filtersArray = []
    for (const filterType in filters) {
      const filterTerms = filters[filterType]
      for (const filterTerm of filterTerms) {
        filtersArray.push({ type: filterType, term: filterTerm })
      }
    }

    const filtersTableRowFunc = data => (
      <PaginatedTable.Row key={data.term}>
        <PaginatedTable.Cell>{data.term}</PaginatedTable.Cell>
        <PaginatedTable.Cell collapsing>{data.type}</PaginatedTable.Cell>
        <PaginatedTable.Cell collapsing>{data.term.startsWith('!') ? <Icon name='check' color='green' /> : null}</PaginatedTable.Cell>
        <PaginatedTable.Cell collapsing>{data.term.startsWith('!~') || data.term.startsWith('~') ? <Icon name='check' color='green' /> : null}</PaginatedTable.Cell>
        <PaginatedTable.Cell collapsing>
          <Button fluid icon='trash' basic color='red' disabled={this.state.removing && this.state.removing.term === data.term && this.state.removing.type === data.type} onClick={e => this.removeFilter(data.type, data.term, e)} />
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
}

FiltersTable.propTypes = {
  removeApiUrl: PropTypes.string
}

export default connect(mapStateToProps)(FiltersTable)
