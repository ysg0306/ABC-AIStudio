import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { BOOKS_DATA, Book } from "./src/data/books.js";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini SDK safely with User-Agent header for AI Studio
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// ----------------------------------------------------
// API 1: Get All Books with Pagination, Search & Filter
// ----------------------------------------------------
app.get("/api/books", (req, res) => {
  const { search, category, publisher, sort } = req.query;

  let filtered = [...BOOKS_DATA];

  // Search keyword (title, author, publisher)
  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.publisher.toLowerCase().includes(q)
    );
  }

  // Category Filter
  if (category && category !== "all") {
    filtered = filtered.filter((b) => b.category === category);
  }

  // Publisher Filter
  if (publisher && publisher !== "all") {
    filtered = filtered.filter((b) => b.publisher === publisher);
  }

  // Sorting
  if (sort) {
    if (sort === "rank") {
      filtered.sort((a, b) => a.rank - b.rank);
    } else if (sort === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sort === "discount") {
      filtered.sort((a, b) => b.discountRate - a.discountRate);
    }
  }

  res.json({
    books: filtered,
    total: filtered.length,
  });
});

// ----------------------------------------------------
// API 2: Get Aggregated Stats for Dashboard Charts
// ----------------------------------------------------
app.get("/api/books/stats", (req, res) => {
  // 1. Publisher distribution
  const publisherMap: { [key: string]: number } = {};
  BOOKS_DATA.forEach((b) => {
    publisherMap[b.publisher] = (publisherMap[b.publisher] || 0) + 1;
  });
  const publishers = Object.entries(publisherMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 publishers

  // 2. Category distribution & average price
  const categoryStats: { [key: string]: { count: number; totalOriginal: number; totalSales: number } } = {};
  BOOKS_DATA.forEach((b) => {
    if (!categoryStats[b.category]) {
      categoryStats[b.category] = { count: 0, totalOriginal: 0, totalSales: 0 };
    }
    categoryStats[b.category].count += 1;
    categoryStats[b.category].totalOriginal += b.originalPrice;
    categoryStats[b.category].totalSales += b.price;
  });
  const categories = Object.entries(categoryStats).map(([name, data]) => ({
    name,
    count: data.count,
    avgOriginalPrice: Math.round(data.totalOriginal / data.count),
    avgPrice: Math.round(data.totalSales / data.count),
  }));

  // 3. Price Ranges
  let range1 = 0; // Under 1.5만원
  let range2 = 0; // 1.5만원 ~ 2만원
  let range3 = 0; // 2만원 ~ 2.5만원
  let range4 = 0; // 2.5만원 ~ 3만원
  let range5 = 0; // 3만원 이상
  BOOKS_DATA.forEach((b) => {
    if (b.price < 15000) range1++;
    else if (b.price >= 15000 && b.price < 20000) range2++;
    else if (b.price >= 20000 && b.price < 25000) range3++;
    else if (b.price >= 25000 && b.price < 30000) range4++;
    else range5++;
  });
  const priceRanges = [
    { name: "1.5만원 미만", value: range1 },
    { name: "1.5만원 ~ 2만원", value: range2 },
    { name: "2만원 ~ 2.5만원", value: range3 },
    { name: "2.5만원 ~ 3만원", value: range4 },
    { name: "3만원 이상", value: range5 },
  ];

  // 4. Release Year/Month Trend (e.g. 2026년 05월 -> parse to Year or Year-Month)
  const monthlyMap: { [key: string]: number } = {};
  BOOKS_DATA.forEach((b) => {
    monthlyMap[b.pubDate] = (monthlyMap[b.pubDate] || 0) + 1;
  });
  const releaseTrend = Object.entries(monthlyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => {
      // Sort by Year and Month (e.g., "2025년 09월" vs "2026년 04월")
      const extractYearMonth = (str: string) => {
        const matches = str.match(/(\d+)년\s*(\d+)월/);
        if (matches) {
          return Number(matches[1]) * 12 + Number(matches[2]);
        }
        return 0;
      };
      return extractYearMonth(a.date) - extractYearMonth(b.date);
    });

  // 5. Basic Metrics Summary
  const totalCount = BOOKS_DATA.length;
  const avgSalesPrice = Math.round(BOOKS_DATA.reduce((acc, b) => acc + b.price, 0) / totalCount);
  const avgOriginalPrice = Math.round(BOOKS_DATA.reduce((acc, b) => acc + b.originalPrice, 0) / totalCount);
  const avgDiscountRate = Math.round(BOOKS_DATA.reduce((acc, b) => acc + b.discountRate, 0) / totalCount);
  const maxPriceBook = [...BOOKS_DATA].sort((a, b) => b.price - a.price)[0];
  const minPriceBook = [...BOOKS_DATA].sort((a, b) => a.price - b.price)[0];

  res.json({
    summary: {
      totalCount,
      avgSalesPrice,
      avgOriginalPrice,
      avgDiscountRate,
      maxPriceBook: { title: maxPriceBook.title, price: maxPriceBook.price },
      minPriceBook: { title: minPriceBook.title, price: minPriceBook.price },
    },
    publishers,
    categories,
    priceRanges,
    releaseTrend,
  });
});

// ----------------------------------------------------
// API 3: RAG Chatbot Endpoint (Retrieval-Augmented Generation)
// ----------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  // 1. Retrieval Phase: keyword extraction & matching against BOOKS_DATA
  const userText = message.toLowerCase();
  
  // Scoring books based on text overlap with user query
  const scoredBooks = BOOKS_DATA.map((book) => {
    let score = 0;
    const title = book.title.toLowerCase();
    const author = book.author.toLowerCase();
    const publisher = book.publisher.toLowerCase();
    const category = book.category.toLowerCase();

    // Check title keywords
    const keywords = userText.split(/\s+/);
    keywords.forEach((keyword: string) => {
      if (keyword.length < 2) return; // Skip tiny words
      
      if (title.includes(keyword)) score += 10;
      if (author.includes(keyword)) score += 5;
      if (publisher.includes(keyword)) score += 3;
      if (category.includes(keyword)) score += 4;
    });

    // Semantic category cues
    if (userText.includes("클로드") && title.includes("클로드")) score += 15;
    if (userText.includes("제미나이") && (title.includes("제미나이") || title.includes("gemini"))) score += 15;
    if (userText.includes("챗gpt") && (title.includes("챗gpt") || title.includes("gpt"))) score += 15;
    if (userText.includes("교사") && (title.includes("교사") || title.includes("학교") || title.includes("수업"))) score += 15;
    if (userText.includes("코딩") && (title.includes("코딩") || title.includes("코드") || title.includes("개발"))) score += 15;
    if (userText.includes("파이썬") && title.includes("파이썬")) score += 15;
    if (userText.includes("엑셀") && title.includes("엑셀")) score += 15;
    if (userText.includes("디자인") && (title.includes("디자인") || title.includes("피그마") || title.includes("캔바"))) score += 15;

    return { book, score };
  });

  // Filter out zero-score books and sort by score descending
  let matchedBooks = scoredBooks
    .filter((sb) => sb.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((sb) => sb.book);

  // If no books match, fallback to top-selling high-rank books as generic recommendations
  if (matchedBooks.length === 0) {
    matchedBooks = BOOKS_DATA.slice(0, 5);
  } else {
    // Limit to top 6 relevant books for concise context
    matchedBooks = matchedBooks.slice(0, 6);
  }

  // 2. Build RAG Context
  const contextString = matchedBooks
    .map(
      (b) =>
        `- [순위 ${b.rank}위] "${b.title}" | 저자: ${b.author} | 출판사: ${b.publisher} | 가격: ${b.price.toLocaleString()}원 (정가: ${b.originalPrice.toLocaleString()}원, ${b.discountRate}% 할인) | 카테고리: ${b.category} | 출간일: ${b.pubDate} | 이미지: ${b.image} | 링크: ${b.link}`
    )
    .join("\n");

  const systemInstruction = `
너는 대한민국 도서 트렌드를 전문 분석하고 맞춤형 도서를 안내해 주는 스마트 도서 추천 RAG AI 비서이다.
사용자가 질문한 내용에 대해 제공된 도서 정보 컨텍스트(Context)를 바탕으로 객관적이고 정확하게 도서를 추천해 주어야 한다.

[도서 컨텍스트 규칙]
1. 반드시 아래 제공되는 "검색된 관련 도서 목록"에 있는 도서들을 바탕으로 우선적으로 추천해라.
2. 각 책을 언급하거나 추천할 때는 책의 순위, 가격, 저자, 출판사를 명확하게 함께 제공해 주어라.
3. 책의 표지 이미지나 바로가기 링크를 다음과 같은 Markdown 양식으로 포함해 줘서 사용자가 쉽게 책을 조회할 수 있도록 만들어라:
   - 책 표지 이미지: ![책제목](이미지_URL) (이미지가 작고 이쁘게 렌더링되도록 해라)
   - 책 상세 링크: [YES24 상세 보기](링크_URL)
4. 답변은 따뜻하고 전문적이며 매우 친근한 어조로 작성해라. 한국어(Korean)로 상냥하게 답해라.
5. 대시보드 통계나 전체 도서 현황에 대해 묻는 경우, 대시보드 탭에 출판사별/카테고리별/가격대별 통계 그래프와 전체 도서 리스트 조회가 가능하다는 점도 같이 안내해 줘라.

[검색된 관련 도서 목록]
${contextString}
`;

  // 3. Call Gemini API safely
  try {
    if (!ai) {
      // Fallback response if GEMINI_API_KEY is missing or invalid in local development
      const fallbackReplies = [
        `안녕하세요! 도서 데이터베이스에서 '${message}'와(과) 관련된 도서를 엄선해 드립니다:\n\n` +
          matchedBooks.map(b => `### ${b.rank}위. ${b.title}\n- **저자/출판사**: ${b.author} / ${b.publisher}\n- **가격**: ${b.price.toLocaleString()}원\n- **링크**: [YES24 상세 보기](${b.link})\n- **표지**: \n![${b.title}](${b.image})`).join("\n\n") +
          `\n\n*(주의: 현재 서버에 Gemini API 키가 올바르게 설정되지 않아 정적 도서 매칭 답변을 제공해 드립니다. Settings > Secrets에서 GEMINI_API_KEY를 등록해 주세요!)*`
      ];
      return res.json({
        reply: fallbackReplies[0],
        retrievedBooks: matchedBooks,
      });
    }

    // Build chat structure
    const chatContents = [];
    if (history && Array.isArray(history)) {
      history.forEach((h: { role: string; content: string }) => {
        chatContents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }],
        });
      });
    }
    chatContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatContents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "죄송합니다. 답변을 생성하지 못했습니다.";

    res.json({
      reply: reply,
      retrievedBooks: matchedBooks,
    });
  } catch (err: any) {
    console.error("Gemini RAG API Error:", err);
    res.status(500).json({
      error: "Gemini API 호출 중 오류가 발생했습니다.",
      details: err.message,
    });
  }
});

// ----------------------------------------------------
// Static Files & Vite Dev Server Integration
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
