import React, { Component } from 'react'
import { bool, func, object, shape, string } from 'prop-types'
import defaults from './defaults'
import { isMaxDimension } from './helpers'

import EventsWrapper from './EventsWrapper'
import Zoom from './Zoom'

const isControlled = isZoomed => isZoomed !== null && isZoomed !== undefined

export default class ImageZoom extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isMaxDimension: false,
      isZoomed: false,
      image: props.image,
      hasAlreadyLoaded: false
    }

    this._handleZoom = this._handleZoom.bind(this)
    this._handleUnzoom = this._handleUnzoom.bind(this)
    this._handleLoad = this._handleLoad.bind(this)
  }

  static get defaultProps() {
    return {
      shouldReplaceImage: true,
      shouldRespectMaxDimension: false,
      zoomMargin: 40,
      defaultStyles: {
        zoomContainer: {},
        overlay: {},
        image: {},
        zoomImage: {}
      },
      shouldHandleZoom: () => true,
      onZoom: () => {},
      onUnzoom: () => {}
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      !isControlled(this.props.isZoomed) &&
      isControlled(nextProps.isZoomed)
    ) {
      throw new Error(defaults.errors.uncontrolled)
    } else if (
      isControlled(this.props.isZoomed) &&
      !isControlled(nextProps.isZoomed)
    ) {
      throw new Error(defaults.errors.controlled)
    }

    /**
     * When component is controlled, we need a flag
     * set when it's about to close in order to keep
     * hiding the original image on the page until the
     * unzooming is complete
     */
    if (this.props.isZoomed && !nextProps.isZoomed) {
      this.isClosing = true
    }

    // If the consumer wants to change the image's src, then so be it.
    if (this.props.image.src !== nextProps.image.src) {
      this.setState({ image: nextProps.image })
    }
  }

  /**
   * When the component's state updates, check for changes
   * and either zoom or start the unzoom procedure.
   * NOTE: We need to differentiate whether this is a
   * controlled or uncontrolled component and do the check
   * based off of that.
   */
  componentDidUpdate(prevProps, prevState) {
    const prevIsZoomed = isControlled(prevProps.isZoomed)
      ? prevProps.isZoomed
      : prevState.isZoomed
    const isZoomed = isControlled(this.props.isZoomed)
      ? this.props.isZoomed
      : this.state.isZoomed
    if (prevIsZoomed !== isZoomed) {
      if (!isZoomed && this.portalInstance) {
        this.portalInstance.unzoom({ force: true })
      }
    }
  }

  render() {
    /**
     * Take whatever attributes you want to pass the image
     * and then override with the properties we need.
     * Also, disable any clicking if the componenet is
     * already at its maximum dimensions.
     */
    const attrs = Object.assign(
      {},
      this.state.image,
      { style: this._getImageStyle() },
      !this.state.isMaxDimension && { onClick: this._handleZoom }
    )
    const isZoomed = isControlled(this.props.isZoomed)
      ? this.props.isZoomed
      : this.state.isZoomed

    return [
      <img
        key="image"
        ref={x => {
          this.image = x
        }}
        onLoad={this._handleLoad}
        {...attrs}
      />,
      isZoomed || this.isClosing ?
        <EventsWrapper
          key="portal"
          ref={node => {
            this.portalInstance = node
          }}
          controlledEventFn={this._getControlledEventFn()}
        >
          <Zoom
            defaultStyles={this.props.defaultStyles}
            image={this.image}
            hasAlreadyLoaded={this.state.hasAlreadyLoaded}
            shouldRespectMaxDimension={this.props.shouldRespectMaxDimension}
            zoomImage={this.props.zoomImage}
            zoomMargin={this.props.zoomMargin}
            onUnzoom={this._handleUnzoom}
          />
        </EventsWrapper>
       : null
    ]
  }

  /**
   * If the image should not exceed its original
   * dimensions AND there is no zoomImage AND the
   * image is already rendered at its maximum dimensions,
   * then we shouldn't try to zoom it at all. We currently
   * only do this on componentDidMount, though on window
   * resize could be something to consider if necessary.
   */
  _checkShouldDisableComponent() {
    this.setState({
      isMaxDimension:
        this.props.shouldRespectMaxDimension &&
        !this.props.zoomImage &&
        isMaxDimension(this.image)
    })
  }

  _getImageStyle() {
    const isHidden =
      this.state.isZoomed || this.props.isZoomed || this.isClosing
    const style = Object.assign({}, isHidden && { visibility: 'hidden' })

    return Object.assign(
      {},
      defaults.styles.image,
      style,
      this.props.defaultStyles.image,
      this.state.image.style,
      this.state.isMaxDimension && { cursor: 'inherit' }
    )
  }

  /**
   * We need to wait for the main image
   * to load before we can do any width/height
   * checks on it.
   */
  _handleLoad() {
    this._checkShouldDisableComponent()
  }

  _handleZoom(event) {
    if (
      !isControlled(this.props.isZoomed) &&
      this.props.shouldHandleZoom(event)
    ) {
      this.setState({ isZoomed: true }, this.props.onZoom)
    } else {
      this.props.onZoom()
    }
  }

  /**
   * This gets passed to the zoomed component as a callback
   * to trigger when the time is right to shut down the zoom.
   * If `shouldReplaceImage`, update the normal image we're showing
   * with the zoomed image -- useful when wanting to replace a low-res
   * image with a high-res one once it's already been downloaded.
   * It also cleans up the zoom references and then updates state.
   */
  _handleUnzoom(src) {
    return () => {
      const changes = Object.assign(
        {},
        { hasAlreadyLoaded: true, isZoomed: false },
        this.props.shouldReplaceImage && {
          image: Object.assign({}, this.state.image, { src })
        }
      )

      /**
       * Lamentable but necessary right now in order to
       * remove the portal instance before the next
       * `componentDidUpdate` check for the portalInstance.
       * The reasoning is so we can differentiate between an
       * external `isZoomed` command and an internal one.
       */
      delete this.isClosing

      this.setState(changes, this.props.onUnzoom)
    }
  }

  _getControlledEventFn() {
    return isControlled(this.props.isZoomed) ? this.props.onUnzoom : null
  }
}

ImageZoom.propTypes = {
  image: shape({
    src: string.isRequired,
    alt: string,
    className: string,
    style: object
  }).isRequired,
  zoomImage: shape({
    src: string,
    alt: string,
    className: string,
    style: object
  }),
  defaultStyles: object,
  isZoomed: bool,
  shouldHandleZoom: func,
  shouldReplaceImage: bool,
  shouldRespectMaxDimension: bool,
  onZoom: func,
  onUnzoom: func
}
