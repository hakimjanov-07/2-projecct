import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import StaleBanner from './components/StaleBanner'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import ScrollToTop from './components/ScrollToTop'
import RevealOnScroll from './components/RevealOnScroll'
import LoadingSpinner from './components/LoadingSpinner'
import Home from './pages/Home'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { ToastProvider } from './context/ToastContext'
import { LanguageProvider } from './i18n/LanguageContext'
import './styles/global.css'

// Bosh sahifa darhol yuklanadi (birinchi sahifa); qolganlari marshrut ochilganda alohida bo'lak (chunk) sifatida
const Books = lazy(() => import('./pages/Books'))
const Authors = lazy(() => import('./pages/Authors'))
const BookDetail = lazy(() => import('./pages/BookDetail'))
const BookReviews = lazy(() => import('./pages/BookReviews'))
const Cart = lazy(() => import('./pages/Cart'))
const About = lazy(() => import('./pages/Static').then((m) => ({ default: m.About })))
const Articles = lazy(() => import('./pages/Static').then((m) => ({ default: m.Articles })))
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })))
const Profile = lazy(() => import('./pages/Profile'))
const Orders = lazy(() => import('./pages/Orders'))
const Favorites = lazy(() => import('./pages/Favorites'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Help = lazy(() => import('./pages/Help'))
const Services = lazy(() => import('./pages/Services'))
const MyBooks = lazy(() => import('./pages/MyBooks'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Marshrutlar xato himoyasi ichida; sahifa o'zgarganda (location.key) xato holati tozalanadi.
// Bo'lak yuklanmasa (internet yo'q, yangi versiya) ErrorBoundary "Sahifani yangilash" ko'rsatadi.
function AppRoutes() {
  const location = useLocation()
  return (
    <ErrorBoundary resetKey={location.key}>
      <Suspense fallback={<main style={{ minHeight: '60vh' }}><LoadingSpinner /></main>}>
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
        <Route path="/orders" element={<Orders />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/about" element={<About />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/services" element={<Services />} />
        <Route path="/help/:page" element={<Help />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

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
        <StaleBanner />
        <AppRoutes />
        <Footer />
      </BrowserRouter>
    </FavoritesProvider>
    </CartProvider>
    </ToastProvider>
    </LanguageProvider>
  )
}
