import styles from './Static.module.css'

export function About() {
  return (
    <main className={styles.wrap}>
      <div className={`${styles.hero} ${styles.aboutHero}`}>
        <p className={styles.eyebrow}>Biz haqimizda</p>
        <h1>Kitobxona</h1>
        <p>O'zbek va jahon adabiyotining eng sara namunalarini sizga yetkazib beramiz</p>
      </div>

      <div className={styles.content}>
        <div className={`${styles.block} ${styles.missionBlock}`}>
          <h2>Bizning missiyamiz</h2>
          <p>Kitobxona — o'zbek kitobxonlariga qulay, ishonchli va zamonaviy onlayn kitob do'koni yaratish maqsadida tashkil etilgan. Biz har bir kitobni sevuvchi inson uchun eng sara asarlarni bir joyga jamlashga harakat qilamiz.</p>
        </div>

        <div className={styles.block}>
          <h2>Nima uchun biz?</h2>
          <div className={styles.featureGrid}>
            {[
              { image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=300&q=85', title: 'Keng tanlov', desc: 'Minglab kitoblar, yuzlab mualliflar' },
              { image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=300&q=85', title: 'Tez yetkazib berish', desc: 'Butun O\'zbekiston bo\'ylab' },
              { image: 'https://images.unsplash.com/photo-1589998059171-988d887df646?auto=format&fit=crop&w=300&q=85', title: 'Sifat kafolati', desc: 'Faqat original va sifatli nashrlar' },
              { image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=85', title: '24/7 qo\'llab-quvvatlash', desc: 'Har qanday savolingizga javob' },
            ].map((f, i) => (
              <div key={i} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <img src={f.image} alt="" />
                </span>
                <p className={styles.featureTitle}>{f.title}</p>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

export function Articles() {
  const articles = [
    { image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=85', title: "Kitob o'qishning 5 muhim foydasi", excerpt: "Muntazam kitob o'qish xotira, e'tibor va ijodiy tafakkurni kuchaytiradi. Ilmiy tadqiqotlar shuni isbotlaganki, har kuni kamida 30 daqiqa kitob o'qish stress darajasini sezilarli kamaytiradi.", time: '3 daqiqa' },
    { image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=85', title: "O'zbek adabiyoti: tarix va bugun", excerpt: "Asrlar davomida shakllanib kelgan o'zbek adabiyotining yorqin sahifalari. Abdulla Qodiriydan Erkin Vohidovgacha — milliy adabiyotimizning buyuk vakillari.", time: '5 daqiqa' },
    { image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=85', title: "Yoshlar uchun 10 ta tavsiya etilgan kitob", excerpt: "Hayotni o'zgartirgan va millionlar qalbiga yo'l topgan asarlar. Ushbu ro'yxatdagi har bir kitob siz haqingizda yangi bir narsani ochib beradi.", time: '4 daqiqa' },
    { image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=85', title: "Jahon adabiyotining durdonalari", excerpt: "Dostoevskiydan Márquezgacha — insoniyat madaniyatiga ulkan hissa qo'shgan asarlar haqida. Bu kitoblarni o'qish — nafaqat badiiy zavq, balki chuqur hayotiy saboq.", time: '6 daqiqa' },
    { image: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=900&q=85', title: "Kitob o'qish va miya salomatligi", excerpt: "Neyrobiologlar tasdiqlagan: muntazam o'qish miyani mashq qildirib, demans va Alzheimer kasalliklariga qarshi muhim himoya vositasi hisoblanadi.", time: '4 daqiqa' },
    { image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=85', title: "Uyda qulay o'qish muhitini yaratish", excerpt: "Yaxshi yorug'lik, qulay o'rindiq va chalg'ituvchi narsalardan xoli joy — samarali o'qish uchun zarur muhitni qanday yaratish haqida amaliy maslahatlar.", time: '3 daqiqa' },
  ]

  return (
    <main className={styles.wrap}>
      <div className={`${styles.hero} ${styles.articlesHero}`} data-reveal>
        <p className={styles.eyebrow}>Maqolalar</p>
        <h1>Kitob dunyosidan</h1>
        <p>Adabiyot, mualliflar va o'qish madaniyati haqida qiziqarli maqolalar</p>
      </div>

      <div className={styles.content}>
        <div className={styles.articlesGrid}>
          {articles.map((a, i) => (
            <div key={i} className={styles.articleCard} data-reveal>
              <div className={styles.articleImg}>
                <img src={a.image} alt="" />
              </div>
              <div className={styles.articleBody}>
                <p className={styles.articleTitle}>{a.title}</p>
                <p className={styles.articleExcerpt}>{a.excerpt}</p>
                <p className={styles.articleMeta}>{a.time} o'qish</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
