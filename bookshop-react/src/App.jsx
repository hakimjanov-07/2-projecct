import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import RevealOnScroll from './components/RevealOnScroll'
import Home from './pages/Home'
import Books from './pages/Books'
import Authors from './pages/Authors'
import BookDetail from './pages/BookDetail'
import BookReviews from './pages/BookReviews'
import Cart from './pages/Cart'
import { About, Articles } from './pages/Static'
import { Login, Register } from './pages/Auth'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import Help from './pages/Help'
import Services from './pages/Services'
import MyBooks from './pages/MyBooks'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { ToastProvider } from './context/ToastContext'
import { LanguageProvider } from './i18n/LanguageContext'
import './styles/global.css'

export default function App() {
  return (
    <LanguageProvider>
    <ToastProvider>
    <CartProvider>
    <FavoritesProvider>
      <BrowserRouter>
        <ScrollToTop />
        <RevealOnScroll />
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/books" element={<Books />} />
          <Route path="/authors" element={<Authors />} />
          <Route path="/books/:id/reviews" element={<BookReviews />} />
          <Route path="/books/:id" element={<BookDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/my-books" element={<MyBooks />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/services" element={<Services />} />
          <Route path="/help/:page" element={<Help />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </FavoritesProvider>
    </CartProvider>
    </ToastProvider>
    </LanguageProvider>
  )
}
