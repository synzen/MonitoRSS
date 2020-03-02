import React, { useState } from 'react'
import PropTypes from 'prop-types'

function BoundedImage (props) {
  const { width: boundedWidth, height: boundedHeight, src, alt } = props
  const [useWidth, setUseWidth] = useState(boundedWidth)
  const [useHeight, setUseHeight] = useState(boundedHeight)

  /**
   * @param {React.SyntheticEvent<HTMLImageElement, Event>} event
   */
  function onLoad (event) {
    const height = event.target.naturalHeight
    const width = event.target.naturalWidth
    if (height < boundedHeight && width < boundedWidth) {
      return
    }
    const heightBigger = height >= width
    if (heightBigger) {
      // Height is bigger
      const scaledHeight = boundedHeight
      const scaledWidth = width * boundedHeight / height
      setUseHeight(scaledHeight)
      setUseWidth(scaledWidth)
    } else {
      // Width is bigger
      const scaledWidth = boundedWidth
      const scaledHeight = height * boundedWidth / width
      setUseHeight(scaledHeight)
      setUseWidth(scaledWidth)
    }
  }

  return (
    <img
      width={useWidth}
      height={useHeight}
      onLoad={onLoad}
      alt={alt}
      src={src} />
  )
}

BoundedImage.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  src: PropTypes.string,
  alt: PropTypes.string
}

export default BoundedImage
