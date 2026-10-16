import { Component } from 'react'

// Dinamik yuklanadigan oyna (xarita va h.k.) yuklanmasa butun sahifa oppoq bo'lib qolmasin:
// xato ushlanadi, onError chaqiriladi (oyna yopiladi, xabar ko'rsatiladi), sahifa ishlashda qoladi.
export default class ModalBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('Oyna yuklanmadi:', error)
    this.props.onError?.(error)
  }

  componentDidUpdate(prevProps) {
    // yangi oyna ochilganda (resetKey o'zgarganda) qayta urinib ko'riladi
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
