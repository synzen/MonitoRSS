import React, { Component } from 'react'
import colors from '../../../constants/colors'
import styled from 'styled-components'
import { Table, Button, Input } from 'semantic-ui-react'
import PropTypes from 'prop-types'
const Row = styled(Table.Row)`
  cursor: pointer;
`

const TableTop = styled.div`
  width: 100%;
  margin-bottom: 1em;
  > .ui.input {
    margin-bottom: 1em;
  }
  > * {
    width: 100%;
  } 
  @media only screen and (min-width: 500px) {
    display: flex;
    justify-content: space-between;
    > .ui.input {
      margin-bottom: 0;
      flex-grow: ${props => props.growInput ? 1 : 0};
    }
    > * {
      width: auto;
    } 
  }
  
`

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${colors.discord.text};
  margin-top: 1em;
`

const PageText = styled.span`
  padding: 0 21px;
`

class PaginatedTable extends Component {
  constructor () {
    super()
    this.state = {
      pages: [],
      page: 0,
      search: ''
    }
  }

  nextPage = () => {
    if (this.state.page >= this.state.pages.length - 1) return
    this.setState({ page: this.state.page + 1 })
  }

  prevPage = () => {
    if (this.state.page <= 0) return
    this.setState({ page: this.state.page - 1 })
  }

  render () {
    const { itemFunc, searchFunc, items, compact, inputStyle, unstackable, collapsing, basic } = this.props
    const maxPerPage = this.props.maxPerPage || 5
    const search = this.state.search
    const pages = []
    let curPage = []
    for (const item of items) {
      if (search && !searchFunc(item, search)) continue
      if (curPage.length < maxPerPage) {
        curPage.push(itemFunc(item))
      } else {
        pages.push(curPage)
        curPage = [ itemFunc(item) ]
      }
    }
    if (curPage.length > 0) pages.push(curPage)
    
    const frontPageLen = pages[this.state.page] ? pages[this.state.page].length : 0
    const fillerRows = []
    if (frontPageLen < maxPerPage) {
      const toFill = maxPerPage - frontPageLen
      for (let i = 0; i < toFill; ++i) {
        fillerRows.push(
          <Table.Row key={`filler-row${i}`}>
            {this.props.headers.map((name, i) => <Table.Cell key={`filler${i}`}>{'\u200b'}</Table.Cell>)}
          </Table.Row>
        )
      }
    }

    return (
      <div>
        <TableTop growInput={!this.props.button}>
          <Input icon='search' iconPosition='left' placeholder='Search...' onChange={e => this.setState({ search: e.target.value })} style={ inputStyle || {} } />
          { this.props.button }
        </TableTop>
        <div style={{overflowX: 'auto'}}>
        <Table celled selectable fixed={false} singleLine compact={compact} unstackable={unstackable} collapsing={collapsing} basic={basic} striped>
          <Table.Header>
            <Row>
              {this.props.headers.map(name => <Table.HeaderCell key={name}>{name}</Table.HeaderCell>  )}
            </Row>
          </Table.Header>
          <Table.Body>
            {pages[this.state.page] ? pages[this.state.page].concat(fillerRows) : fillerRows}
          </Table.Body>
        </Table></div>
        <Footer>
          {pages.reduce((acc, cv) => acc + cv.length, 0)} total
          <div>
            <Button icon='left chevron' disabled={this.state.page <= 0} onClick={e => this.setState({ page: this.state.page - 1 })} />
            <PageText>{`${pages.length === 0 ? 0 : this.state.page + 1}/${pages.length}`}</PageText>
            {/* <Button content={`${pages.length === 0 ? 0 : this.state.page + 1}/${pages.length}`} basic disabled /> */}
            <Button icon='right chevron' disabled={this.state.page >= pages.length - 1} onClick={e => this.setState({ page: this.state.page + 1 })} />
          </div>
        </Footer>
      </div>
    )
  }
}

PaginatedTable.propTypes = {
  items: PropTypes.array,
  searchFunc: PropTypes.func,
  itemFunc: PropTypes.func,
  maxPerPage: PropTypes.number
}

export default {
  Cell: Table.Cell,
  Table: PaginatedTable,
  Row: Table.Row,
}
