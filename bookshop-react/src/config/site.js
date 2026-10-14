// Sayt bo'yicha umumiy ma'lumotlar (navbar, footer va savatdagi "Olib ketish" oynasi shu yerdan oladi)
export const SITE = {
  phone: '998(71) 230-00-50',
  phoneLink: '+998712300050',
  workingHours: '09:00 - 22:00',

  // Do'kon (olib ketish nuqtasi). TODO: HAQIQIY MA'LUMOTLARNI YOZING!
  // Hozirgi manzil va koordinatalar vaqtinchalik (Toshkent markazi), real do'kon emas.
  store: {
    // TODO: haqiqiy manzilni yozing (har til uchun)
    address: {
      uz: 'Toshkent shahri, markaz (TODO: haqiqiy manzilni yozing)',
      ru: 'г. Ташкент, центр (TODO: укажите настоящий адрес)',
      en: 'Tashkent, city center (TODO: add the real address)',
    },
    // TODO: haqiqiy do'kon koordinatalari (Google/Yandex xaritadan olinadi)
    lat: 41.2995,
    lng: 69.2401,
    // TODO: kerak bo'lsa qo'shimcha telefon raqamlarni shu ro'yxatga qo'shing
    phones: [{ label: '998(71) 230-00-50', link: '+998712300050' }],
  },

  // Ijtimoiy tarmoq havolalari. Footer'da to'rtala ikonka ko'rinadi:
  // havola yozilsa bosiladigan bo'ladi, bo'sh qoldirilsa "tez orada" holatida turadi.
  // Masalan: instagram: 'https://instagram.com/sizning_sahifangiz'
  social: {
    instagram: '',
    telegram: '',
    facebook: '',
    youtube: '',
  },
}
