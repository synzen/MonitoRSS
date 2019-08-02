import React from 'react'
import posed from 'react-pose'
import { Button } from 'semantic-ui-react'

export default posed(React.forwardRef((props, ref) => (<span ref={ref}><Button {...props} /></span>)))({
  enter: { scale: 1, opacity: 1, transition: { duration: 150 } },
  exit: { scale: 0.8, opacity: 0, transition: { duration: 150 } }
})
