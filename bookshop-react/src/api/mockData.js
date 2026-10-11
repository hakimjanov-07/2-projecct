// Mock data for development when backend is unavailable
export const mockBooks = {
  results: [
    { id: 1, name: "O'zbek tili", category: 1, author: 1, category_name: "Ta'lim", author_name: "Ali Orifov", price: "45000", photo: null, about: "O'zbek tilini o'rganish uchun", language: "Uzbek", publisher: "Sharq", pages: 256 },
    { id: 2, name: "Dostoevskiy asarlari", category: 2, author: 2, category_name: "ادب", author_name: "Fedor Dostoevskiy", price: "65000", photo: null, about: "Klassik asar", language: "Russian", publisher: "Mir", pages: 512 },
    { id: 3, name: "Jahon adabiyoti", category: 3, author: 3, category_name: "Ma'lumot", author_name: "Muhammad Amin", price: "55000", photo: null, about: "Jahon adabiyotining tarixiy qaydlari", language: "Uzbek", publisher: "Ilm", pages: 384 },
    { id: 4, name: "Kitob o'qishning san'ati", category: 1, author: 1, category_name: "Ta'lim", author_name: "Ali Orifov", price: "35000", photo: null, about: "Samarali kitob o'qish usullari", language: "Uzbek", publisher: "Sharq", pages: 192 },
    { id: 5, name: "Tolstoy asarlari", category: 2, author: 4, category_name: "ادب", author_name: "Lev Tolstoy", price: "75000", photo: null, about: "Eng mashhur asar", language: "Russian", publisher: "Mir", pages: 768 },
    { id: 6, name: "Navoiy Asarshunos", category: 3, author: 5, category_name: "Ma'lumot", author_name: "O'zbek olimlari", price: "50000", photo: null, about: "Navoiy hayoti va ijodiyoti", language: "Uzbek", publisher: "Ilm", pages: 320 },
    { id: 7, name: "Buyuk thinkers", category: 4, author: 6, category_name: "Falsafa", author_name: "Karl Yaspersz", price: "60000", photo: null, about: "Dunyo falsafasiga kirish", language: "English", publisher: "Academic", pages: 448 },
    { id: 8, name: "Python dasturlash", category: 5, author: 7, category_name: "Texnologiya", author_name: "Abdulhamid", price: "70000", photo: null, about: "Python bilan dasturlashni o'rganamiz", language: "Uzbek", publisher: "Tech", pages: 400 },
  ]
};

export const mockAuthors = {
  results: [
    { id: 1, full_name: "Ali Orifov", photo: null },
    { id: 2, full_name: "Fedor Dostoevskiy", photo: null },
    { id: 3, full_name: "Muhammad Amin", photo: null },
    { id: 4, full_name: "Lev Tolstoy", photo: null },
    { id: 5, full_name: "O'zbek olimlari", photo: null },
    { id: 6, full_name: "Karl Yaspersz", photo: null },
    { id: 7, full_name: "Abdulhamid", photo: null },
  ]
};

export const mockCategories = {
  results: [
    { id: 1, name: "Ta'lim" },
    { id: 2, name: "ادب" },
    { id: 3, name: "Ma'lumot" },
    { id: 4, name: "Falsafa" },
    { id: 5, name: "Texnologiya" },
  ]
};
