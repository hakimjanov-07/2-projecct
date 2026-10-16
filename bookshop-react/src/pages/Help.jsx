import { useParams } from 'react-router-dom'
import { useLang } from '../i18n/LanguageContext'
import useDocumentTitle from '../useDocumentTitle'
import NotFound from './NotFound'
import styles from './Static.module.css'

// Yordam sahifalari matni (namuna): to'lov, yetkazib berish, maxfiylik
const PAGES = {
  payment: {
    uz: {
      title: "To'lov usullari",
      lead: "Buyurtma uchun qulay usulda to'lang",
      blocks: [
        { h: 'Naqd pul', p: "Buyurtmani qabul qilganingizda kuryerga naqd pul bilan to'lashingiz mumkin." },
        { h: 'Bank kartasi', p: "Onlayn to'lov hali mavjud emas. Hozircha to'lov buyurtmani olib ketganda yoki yetkazib berilganda amalga oshiriladi (naqd yoki karta orqali). Karta ma'lumotlaringiz bizning serverimizda saqlanmaydi." },
        { h: 'Promo kod', p: "Savat sahifasida promo kodni kiriting, chegirma buyurtma summasiga avtomatik qo'llanadi." },
      ],
    },
    ru: {
      title: 'Способы оплаты',
      lead: 'Оплачивайте заказ удобным способом',
      blocks: [
        { h: 'Наличные', p: 'Вы можете оплатить заказ наличными курьеру при получении.' },
        { h: 'Банковская карта', p: 'Онлайн-оплата пока недоступна. Сейчас оплата производится при получении заказа в магазине или при доставке (наличными или картой). Данные вашей карты не хранятся на нашем сервере.' },
        { h: 'Промокод', p: 'Введите промокод на странице корзины, скидка применится к сумме заказа автоматически.' },
      ],
    },
    en: {
      title: 'Payment methods',
      lead: 'Pay for your order the way that suits you',
      blocks: [
        { h: 'Cash', p: 'You can pay the courier in cash when you receive your order.' },
        { h: 'Bank card', p: 'Online payment is not available yet. For now, you pay when you pick up your order or when it is delivered (in cash or by card). Your card details are not stored on our server.' },
        { h: 'Promo code', p: 'Enter a promo code in the cart and the discount is applied to your order automatically.' },
      ],
    },
  },
  delivery: {
    uz: {
      title: 'Yetkazib berish',
      lead: "Buyurtmangiz o'zingiz aytgan manzilga yetkaziladi",
      blocks: [
        { h: 'Narxi', p: "Yetkazib berish 20 000 so'm. Buyurtma summasi 300 000 so'm va undan ko'p bo'lsa, yetkazib berish bepul." },
        { h: 'Muddati', p: 'Buyurtma tasdiqlangandan keyin odatda 1-3 ish kuni ichida yetkaziladi. Aniq muddatni operator telefon orqali aytadi.' },
        { h: 'Buyurtma holati', p: "Buyurtmangiz holatini profilingizdagi buyurtmalar bo'limida kuzatishingiz mumkin." },
      ],
    },
    ru: {
      title: 'Доставка',
      lead: 'Заказ доставляется по указанному вами адресу',
      blocks: [
        { h: 'Стоимость', p: 'Доставка стоит 20 000 сум. При сумме заказа от 300 000 сум доставка бесплатная.' },
        { h: 'Сроки', p: 'Обычно заказ доставляется в течение 1-3 рабочих дней после подтверждения. Точный срок сообщит оператор по телефону.' },
        { h: 'Статус заказа', p: 'Следить за статусом заказа можно в разделе заказов вашего профиля.' },
      ],
    },
    en: {
      title: 'Delivery',
      lead: 'Your order is delivered to the address you give us',
      blocks: [
        { h: 'Price', p: 'Delivery costs 20,000 UZS. Orders of 300,000 UZS or more ship free.' },
        { h: 'Timing', p: 'Orders are usually delivered within 1-3 business days after confirmation. An operator will confirm the exact time by phone.' },
        { h: 'Order status', p: 'You can follow your order status in the orders section of your profile.' },
      ],
    },
  },
  privacy: {
    uz: {
      title: 'Maxfiylik siyosati',
      lead: "Ma'lumotlaringiz biz uchun muhim",
      blocks: [
        { h: "Qanday ma'lumot yig'amiz", p: "Ro'yxatdan o'tishda username va email, buyurtma uchun esa yetkazib berish uchun kerakli ma'lumotlarni olamiz." },
        { h: 'Qanday foydalanamiz', p: "Ma'lumotlar faqat buyurtmani bajarish, hisobingizni himoyalash va siz bilan bog'lanish uchun ishlatiladi. Uchinchi shaxslarga sotilmaydi." },
        { h: 'Parol xavfsizligi', p: "Parollar shifrlangan holda saqlanadi, biz ularni ko'ra olmaymiz." },
        { h: 'Savollar', p: "Maxfiylik bo'yicha savollar uchun sahifa pastidagi telefon raqami orqali bog'laning." },
      ],
    },
    ru: {
      title: 'Политика конфиденциальности',
      lead: 'Ваши данные важны для нас',
      blocks: [
        { h: 'Какие данные мы собираем', p: 'При регистрации мы получаем имя пользователя и email, а при заказе - данные, необходимые для доставки.' },
        { h: 'Как мы их используем', p: 'Данные используются только для выполнения заказа, защиты аккаунта и связи с вами. Мы не передаём их третьим лицам.' },
        { h: 'Безопасность пароля', p: 'Пароли хранятся в зашифрованном виде, мы не можем их видеть.' },
        { h: 'Вопросы', p: 'По вопросам конфиденциальности свяжитесь с нами по телефону в нижней части сайта.' },
      ],
    },
    en: {
      title: 'Privacy policy',
      lead: 'Your data matters to us',
      blocks: [
        { h: 'What we collect', p: 'At sign-up we collect a username and email; for orders we collect the details needed for delivery.' },
        { h: 'How we use it', p: 'Data is used only to fulfil orders, protect your account and contact you. We never sell it to third parties.' },
        { h: 'Password security', p: 'Passwords are stored hashed, so we cannot see them.' },
        { h: 'Questions', p: 'For privacy questions, call the phone number shown at the bottom of the site.' },
      ],
    },
  },
}

export default function Help() {
  const { page } = useParams()
  // hasOwn: /help/constructor, /help/__proto__ kabi prototip kalitlari "mavjud sahifa" bo'lib qolmasin
  if (!Object.hasOwn(PAGES, page)) return <NotFound />
  return <HelpPage page={page} />
}

function HelpPage({ page }) {
  const { lang } = useLang()
  const data = PAGES[page]
  const c = data[lang] ?? data.uz
  useDocumentTitle(c.title)

  return (
    <main className={styles.wrap}>
      <div className={`${styles.hero} ${styles.helpHero} ${styles[`${page}Hero`]}`}>
        <h1>{c.title}</h1>
        <p>{c.lead}</p>
      </div>
      <div className={styles.content}>
        {c.blocks.map((b) => (
          <div key={b.h} className={`${styles.block} ${styles.helpBlock}`} data-reveal>
            <h2>{b.h}</h2>
            <p>{b.p}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
