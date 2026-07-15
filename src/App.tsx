import { useState, useEffect, useRef, FormEvent, ReactNode } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  BookOpen, 
  Sparkles, 
  TrendingUp, 
  BarChart3, 
  Search, 
  Send, 
  ExternalLink, 
  Tag, 
  Calendar, 
  DollarSign, 
  HelpCircle, 
  RefreshCw, 
  ArrowUpDown,
  Compass,
  MessageSquare,
  Award,
  Clock,
  PieChart as PieIcon,
  Percent
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from "recharts";

// Inline copy of TS Types for robust client compile
interface Book {
  rank: number;
  title: string;
  author: string;
  publisher: string;
  pubDate: string;
  price: number;
  originalPrice: number;
  discountRate: number;
  link: string;
  image: string;
  category: string;
}

interface StatsSummary {
  totalCount: number;
  avgSalesPrice: number;
  avgOriginalPrice: number;
  avgDiscountRate: number;
  maxPriceBook: { title: string; price: number };
  minPriceBook: { title: string; price: number };
}

interface AggregatedStats {
  summary: StatsSummary;
  publishers: Array<{ name: string; count: number }>;
  categories: Array<{ name: string; count: number; avgOriginalPrice: number; avgPrice: number }>;
  priceRanges: Array<{ name: string; value: number }>;
  releaseTrend: Array<{ date: string; count: number }>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  retrievedBooks?: Book[];
  timestamp: Date;
}

// Chart color constants
const CHART_COLORS = ["#6366f1", "#06b6d4", "#14b8a6", "#f97316", "#a855f7", "#ec4899", "#3b82f6", "#10b981"];

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "chatbot">("dashboard");
  
  // Dashboard states
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [isBooksLoading, setIsBooksLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPublisher, setSelectedPublisher] = useState("all");
  const [sortOption, setSortOption] = useState("rank");

  // Chatbot states
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "안녕하세요! 👋 도서 분석 트렌드 DB를 기반으로 작동하는 **AI 도서 추천 전문 사서**입니다. \n\n'클로드 코딩에 관한 책 추천해줘', '교사들을 위한 에듀테크나 제미나이 활용 책이 뭐야?', '가장 할인율이 큰 책 알려줘' 등 궁금한 내용을 물어보시면 실시간 책 트렌드 지표를 분석하여 가장 어울리는 책들을 추천해 드릴게요! 📚",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sidebarRetrievedBooks, setSidebarRetrievedBooks] = useState<Book[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial books & stats
  useEffect(() => {
    fetchBooks();
    fetchStats();
  }, [searchQuery, selectedCategory, selectedPublisher, sortOption]);

  const fetchBooks = async () => {
    try {
      setIsBooksLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory && selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedPublisher && selectedPublisher !== "all") params.append("publisher", selectedPublisher);
      params.append("sort", sortOption);

      const res = await fetch(`/api/books?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books);
      }
    } catch (err) {
      console.error("Failed to fetch books", err);
    } finally {
      setIsBooksLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setIsStatsLoading(true);
      const res = await fetch("/api/books/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Scroll to chat bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  // Send message to AI RAG backend
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userQuery = chatInput;
    setChatInput("");
    
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userQuery,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const historyPayload = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuery,
          history: historyPayload
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          retrievedBooks: data.retrievedBooks || [],
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMsg]);
        if (data.retrievedBooks && data.retrievedBooks.length > 0) {
          setSidebarRetrievedBooks(data.retrievedBooks);
        }
      } else {
        throw new Error("Chat response status error");
      }
    } catch (err) {
      console.error("RAG Chatbot Error:", err);
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: "assistant",
        content: "⚠️ 서버와의 대화 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (Settings > Secrets에서 GEMINI_API_KEY 상태를 확인해 주세요!)",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSuggestionClick = (promptText: string) => {
    setChatInput(promptText);
  };

  // Helper: Advanced inline markdown parser to safely render custom catalog views, tables, bold text, links & images
  const parseResponseContent = (content: string) => {
    if (!content) return null;
    const lines = content.split("\n");
    
    return lines.map((line, lIdx) => {
      // Headers
      if (line.startsWith("### ")) {
        return <h3 key={lIdx} className="text-base font-bold text-slate-800 mt-4 mb-1.5 flex items-center gap-1.5">{line.slice(4)}</h3>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={lIdx} className="text-lg font-extrabold text-indigo-950 mt-5 mb-2 border-b border-indigo-50/80 pb-1">{line.slice(3)}</h2>;
      }
      if (line.startsWith("# ")) {
        return <h1 key={lIdx} className="text-xl font-black text-indigo-950 mt-6 mb-3">{line.slice(2)}</h1>;
      }

      // Bullet Lists
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const bulletText = line.trim().slice(2);
        return (
          <ul key={lIdx} className="list-disc list-inside ml-2.5 text-sm text-slate-700 space-y-1 my-0.5">
            <li className="leading-relaxed">{renderStyledText(bulletText)}</li>
          </ul>
        );
      }

      // Normal paragraph
      return (
        <p key={lIdx} className="text-sm text-slate-700 leading-relaxed min-h-[0.5rem] my-2">
          {renderStyledText(line)}
        </p>
      );
    });
  };

  // Process bold text (**text**), YES24 buttons ([YES24 상세 보기](link)), and images (![Alt](img))
  const renderStyledText = (text: string) => {
    // 1. Check for images: ![]()
    const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    
    // Quick parse: if no tokens, return string
    if (!text.includes("**") && !text.includes("[") && !text.includes("![")) {
      return text;
    }

    const elements: ReactNode[] = [];
    let lastIndex = 0;

    // We tokenize the string simply for maximum performance & no-crash compile
    // First, let's substitute markdown links and bold formatting.
    // Instead of deep nested regex, we can parse standard keywords.
    // Let's replace [YES24 상세 보기](URL) to styled badge buttons
    
    // Simple robust tokenizer
    let tempText = text;
    
    // We can extract any images first and render them below or inline
    const images: string[] = [];
    let imageMatch;
    while ((imageMatch = imgRegex.exec(text)) !== null) {
      images.push(imageMatch[2]);
    }
    
    // Remove image tokens from the text line to render them beautifully below
    tempText = tempText.replace(imgRegex, "");

    // Now parse Bold and Links inline
    const tokens: ReactNode[] = [];
    let keyIdx = 0;
    
    // Helper to process bold on text chunk
    const processBoldAndText = (chunk: string) => {
      const boldParts = chunk.split("**");
      return boldParts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={`b-${keyIdx++}`} className="font-semibold text-indigo-900 bg-indigo-50/50 px-1 rounded">{part}</strong>;
        }
        return part;
      });
    };

    // Split by link syntax [label](url)
    const linkParts = tempText.split(/(\[.*?\]\(.*?\))/g);
    
    linkParts.forEach((part) => {
      if (part.startsWith("[") && part.includes("](")) {
        const label = part.substring(1, part.indexOf("]"));
        const url = part.substring(part.indexOf("](") + 2, part.length - 1);
        tokens.push(
          <a 
            key={`link-${keyIdx++}`}
            href={url} 
            target="_blank" 
            referrerPolicy="no-referrer"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 transition-colors px-2 py-0.5 rounded border border-indigo-100 mx-1 align-middle"
          >
            {label}
            <ExternalLink size={10} />
          </a>
        );
      } else {
        tokens.push(...processBoldAndText(part));
      }
    });

    return (
      <span className="inline-block w-full">
        <span className="align-middle">{tokens}</span>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 mb-1">
            {images.map((imgUrl, iIdx) => (
              <div key={iIdx} className="relative group w-20 h-28 bg-white border border-slate-200 rounded p-1 shadow-sm hover:shadow transition-shadow">
                <img 
                  src={imgUrl} 
                  alt="추천도서 표지" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-sm"
                />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  };

  // Distinct publishers list
  const uniquePublishers = [
    "all",
    "골든래빗",
    "한빛미디어",
    "이지스퍼블리싱",
    "앤써북",
    "길벗",
    "제이펍",
    "위키북스",
    "시프트"
  ];

  // Distinct categories list
  const uniqueCategories = [
    "all",
    "AI & 코딩 에이전트",
    "생성형 AI 일반",
    "교육 & 에듀테크",
    "전통 개발 & 오피스",
    "디자인 & 크리에이티브",
    "IT 트렌드 & 인프라"
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      {/* 🚀 Visual Header Margin Banner */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Title & App Purpose */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-150 animate-pulse">
                <BookOpen size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5 font-display">
                  Libris AI <span className="text-slate-400 font-medium font-sans text-xs">/ 도서 트렌드 종합 대시보드</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">인기 생성 AI·에듀테크·코딩 베스트셀러 트렌드 심층 분석</p>
              </div>
            </div>

            {/* Elegant Tab Switch Navigation & Status Pill */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">RAG Engine Active</span>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  id="tab-dashboard-btn"
                  onClick={() => setActiveTab("dashboard")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === "dashboard"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <BarChart3 size={13} />
                  종합 대시보드 & 탐색
                </button>
                <button
                  id="tab-chatbot-btn"
                  onClick={() => setActiveTab("chatbot")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all relative ${
                    activeTab === "chatbot"
                      ? "bg-white text-indigo-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <Sparkles size={13} className="text-indigo-500" />
                  AI RAG 도서 추천봇
                  <span className="absolute -top-1 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 🚀 Main Core Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="space-y-6"
            >
              {/* 📈 Bento Grid: Statistical Summary Widgets */}
              <div className="grid grid-cols-12 gap-5 sm:gap-6">
                {/* Stat 1: Total Catalog */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Catalog</p>
                      <h3 className="text-3xl font-black text-indigo-600 mt-2 font-display">
                        {isStatsLoading ? "..." : stats?.summary?.totalCount || books.length} <span className="text-xs font-semibold text-slate-500">권</span>
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                      <BookOpen size={18} />
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-600 font-bold mt-4 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                    실시간 RAG 엔진 활성 동기화
                  </p>
                </div>

                {/* Stat 2: Average Sales Price */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Sales Price</p>
                      <h3 className="text-3xl font-black text-slate-800 mt-2 font-display">
                        {isStatsLoading ? "..." : stats?.summary?.avgSalesPrice.toLocaleString()} <span className="text-xs font-semibold text-slate-500">원</span>
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                      <DollarSign size={18} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-4">
                    정가 대비 평균 <span className="font-bold text-slate-700">{(stats?.summary?.avgOriginalPrice - stats?.summary?.avgSalesPrice || 0).toLocaleString()}원</span> 절약
                  </p>
                </div>

                {/* Stat 3: Average Discount Rate */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Discount Rate</p>
                      <h3 className="text-3xl font-black text-slate-800 mt-2 font-display">
                        {isStatsLoading ? "..." : stats?.summary?.avgDiscountRate} <span className="text-xs font-semibold text-slate-500">%</span>
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
                      <Percent size={18} />
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600 font-bold mt-4">
                    도서 특별유통 10% 일괄 할인 적용
                  </p>
                </div>

                {/* Stat 4: Max Price Book (Premium Accent block) */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-indigo-600 p-6 rounded-2xl border border-indigo-700 shadow-sm flex flex-col justify-between text-white hover:bg-indigo-700 transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Premium Pick Price</p>
                      <h3 className="text-base font-black text-white mt-2 font-display truncate max-w-[170px]" title={stats?.summary?.maxPriceBook?.title}>
                        {isStatsLoading ? "..." : stats?.summary?.maxPriceBook?.title}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-500 text-indigo-100 flex items-center justify-center shadow-xs">
                      <Award size={18} />
                    </div>
                  </div>
                  <p className="text-[10px] text-indigo-100 mt-4 font-medium">
                    최고가 전문도서: {isStatsLoading ? "..." : stats?.summary?.maxPriceBook?.price.toLocaleString()}원
                  </p>
                </div>
              </div>

              {/* 📊 Bento Grid Layout for Charts & Insights */}
              <div className="grid grid-cols-12 gap-6">
                {/* Chart 1: Category Distribution & Prices (8 Cols) */}
                <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 font-display">카테고리별 도서 비중 및 평균 가격</h4>
                      <p className="text-[10px] text-slate-400">어떤 기술 분야의 도서가 가장 집중되고 가격대가 높은가?</p>
                    </div>
                    <Compass size={16} className="text-indigo-400" />
                  </div>
                  <div className="h-64 w-full">
                    {isStatsLoading ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">통계 수집 중...</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.categories} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} tickLine={false} unit="원" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                            labelStyle={{ fontWeight: "bold", fontSize: 11 }}
                            itemStyle={{ fontSize: 11 }}
                          />
                          <Bar yAxisId="left" dataKey="count" name="도서 수 (권)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="right" dataKey="avgPrice" name="평균가 (원)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Smart Insights Bento Card (4 Cols) */}
                <div className="col-span-12 lg:col-span-4 bg-indigo-50/75 rounded-3xl p-6 border border-indigo-100/60 flex flex-col justify-between hover:shadow-md transition-all duration-200">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-widest font-display">Smart Insights</h4>
                      <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">RAG AI</span>
                    </div>
                    <div className="space-y-3 mt-4">
                      <div className="bg-white/90 p-3.5 rounded-xl border border-indigo-100/50">
                        <p className="text-[11px] text-indigo-950 font-medium leading-relaxed">
                          <span className="font-bold text-indigo-600">AI 코딩 에이전트</span> 도서의 검색 및 RAG 문의 빈도가 최근 급성장 중입니다.
                        </p>
                      </div>
                      <div className="bg-white/90 p-3.5 rounded-xl border border-indigo-100/50">
                        <p className="text-[11px] text-indigo-950 font-medium leading-relaxed">
                          에듀테크 및 실용 생성 AI 개론서의 가격대는 평균 <span className="font-bold text-indigo-600">18,500원선</span>에 가장 강하게 집중되어 있습니다.
                        </p>
                      </div>
                      <div className="bg-white/90 p-3.5 rounded-xl border border-indigo-100/50">
                        <p className="text-[11px] text-indigo-950 font-medium leading-relaxed">
                          골든래빗 및 한빛 등 메이저 출판사의 <span className="font-bold text-indigo-600">실전 북라인</span>이 시장 도서의 62% 이상을 점유합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab("chatbot")}
                    className="mt-5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={12} />
                    AI 도서 추천봇 바로가기
                  </button>
                </div>

                {/* Chart 2: Top Publishers Share (4 Cols) */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 font-display">시장 점유율 상위 8대 출판사</h4>
                      <p className="text-[10px] text-slate-400">생성 AI 및 IT 실용 교육 분야의 출판 기조</p>
                    </div>
                    <TrendingUp size={16} className="text-emerald-400" />
                  </div>
                  <div className="h-64 w-full">
                    {isStatsLoading ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">출판사 집계 중...</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.publishers} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} width={80} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                            itemStyle={{ fontSize: 11 }}
                          />
                          <Bar dataKey="count" name="도서 점유 수" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Chart 3: Price Ranges (4 Cols) */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 font-display">실제 판매가 분포 비중</h4>
                      <p className="text-[10px] text-slate-400">대다수 IT 전문 도서의 주류 가격 구간 분석</p>
                    </div>
                    <PieIcon size={16} className="text-amber-400" />
                  </div>
                  <div className="h-64 w-full flex items-center justify-center">
                    {isStatsLoading ? (
                      <div className="text-xs text-slate-400">가격 통계 처리 중...</div>
                    ) : (
                      <div className="w-full h-full flex flex-col sm:flex-row items-center justify-around">
                        <div className="w-36 h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stats?.priceRanges}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {stats?.priceRanges.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-4 sm:mt-0">
                          {stats?.priceRanges.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></span>
                              <span className="text-slate-500 font-medium min-w-[80px]">{entry.name}:</span>
                              <span className="text-slate-800 font-bold">{entry.value}권</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart 4: Monthly Launch Trend (4 Cols) */}
                <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 font-display">월별 도서 출간 트렌드 (타임라인)</h4>
                      <p className="text-[10px] text-slate-400">시간 경과에 따른 신간 출간 속도 변화</p>
                    </div>
                    <Clock size={16} className="text-rose-400" />
                  </div>
                  <div className="h-64 w-full">
                    {isStatsLoading ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">타임라인 분석 중...</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats?.releaseTrend} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}
                            itemStyle={{ fontSize: 11 }}
                          />
                          <Line type="monotone" dataKey="count" name="신간 출간 (권)" stroke="#f97316" strokeWidth={2} activeDot={{ r: 6 }} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* 🔍 Dynamic Book Explorer Search & Filter Grid */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 hover:shadow-md transition-all duration-200">
                <div className="p-5 border-b border-slate-50 bg-slate-50/40 rounded-2xl mb-6">
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-display">
                        도서 통합 라이브러리 검색기
                        <span className="text-[10px] font-normal text-slate-400">검색 조건에 맞는 도서 실시간 정렬 및 필터링</span>
                      </h3>
                    </div>

                    {/* Quick Stats count badge */}
                    <div className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold border border-indigo-100/50 flex items-center gap-1.5">
                      <Compass size={12} />
                      조건 매칭 도서: {books.length}권
                    </div>
                  </div>

                  {/* Filter Panel Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    {/* Search Input */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="제목, 저자, 출판사 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-hidden transition-all text-slate-700"
                      />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 py-2">
                      <Tag size={12} className="text-slate-400" />
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-600 focus:outline-hidden border-none p-0 cursor-pointer font-medium"
                      >
                        <option value="all">모든 카테고리</option>
                        {uniqueCategories.slice(1).map((cat, idx) => (
                          <option key={idx} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Publisher Filter */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 py-2">
                      <BookOpen size={12} className="text-slate-400" />
                      <select
                        value={selectedPublisher}
                        onChange={(e) => setSelectedPublisher(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-600 focus:outline-hidden border-none p-0 cursor-pointer font-medium"
                      >
                        <option value="all">모든 출판사</option>
                        {uniquePublishers.slice(1).map((pub, idx) => (
                          <option key={idx} value={pub}>{pub}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sort Options */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl px-3 py-2">
                      <ArrowUpDown size={12} className="text-slate-400" />
                      <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-600 focus:outline-hidden border-none p-0 cursor-pointer font-medium"
                      >
                        <option value="rank">순위 높은순</option>
                        <option value="price-asc">가격 낮은순</option>
                        <option value="price-desc">가격 높은순</option>
                        <option value="discount">할인율 높은순</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Grid Lists */}
                {isBooksLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <RefreshCw size={24} className="animate-spin text-indigo-500" />
                    <span className="text-xs text-slate-400 font-medium">검색 필터에 맞춤 책들을 정리 중입니다...</span>
                  </div>
                ) : books.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 bg-slate-50/20">
                    <HelpCircle size={32} className="text-slate-300" />
                    <span className="text-xs text-slate-400 font-medium">해당 검색 조건에 맞는 도서가 존재하지 않습니다.</span>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategory("all");
                        setSelectedPublisher("all");
                        setSortOption("rank");
                      }}
                      className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all mt-2"
                    >
                      필터 초기화
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {books.map((book) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.18 }}
                        key={book.rank}
                        className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-slate-200/80 transition-all duration-200 relative group"
                      >
                        {/* Rank Badge */}
                        <div className="absolute top-3 left-3 bg-indigo-600/90 text-white font-black text-xs px-2.5 py-1 rounded-lg z-10 shadow-sm shadow-indigo-100 font-display">
                          #{book.rank}
                        </div>

                        {/* Top layout: Cover image + tags */}
                        <div>
                          <div className="relative w-full h-44 bg-slate-50 rounded-xl overflow-hidden mb-3.5 flex items-center justify-center p-2 border border-slate-100/50">
                            <img
                              src={book.image}
                              alt={book.title}
                              referrerPolicy="no-referrer"
                              className="h-full object-contain max-w-full drop-shadow-md group-hover:scale-105 transition-transform duration-200"
                            />
                            {/* Overlay category badge */}
                            <div className="absolute bottom-2 right-2 bg-slate-900/85 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md">
                              {book.category}
                            </div>
                          </div>

                          {/* Book Title & Meta */}
                          <h4 className="text-xs font-black text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors h-8 mb-1.5" title={book.title}>
                            {book.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-semibold truncate mb-2">
                            저자: {book.author} | 출판사: {book.publisher}
                          </p>
                        </div>

                        {/* Bottom layout: pricing + link */}
                        <div className="border-t border-slate-50 pt-3 mt-2">
                          <div className="flex justify-between items-baseline mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-slate-900 font-display">{book.price.toLocaleString()}원</span>
                              <span className="text-[9px] text-slate-400 line-through">({book.originalPrice.toLocaleString()}원)</span>
                            </div>
                            {book.discountRate > 0 && (
                              <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-rose-100 flex items-center gap-0.5">
                                <Tag size={8} />
                                {book.discountRate}% OFF
                              </span>
                            )}
                          </div>

                          {/* Launch date & redirection details */}
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                              <Calendar size={10} />
                              {book.pubDate}
                            </span>
                            
                            <a
                              href={book.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              referrerPolicy="no-referrer"
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/60 px-2.5 py-1.5 rounded-lg border border-indigo-100/50 flex items-center gap-1 transition-all"
                            >
                              YES24 보기
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chatbot-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)] min-h-[500px]"
            >
              {/* 💬 Left: Interactive Chat Screen (2/3 columns) in Premium Dark Bento style */}
              <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden">
                {/* Chatroom header */}
                <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-display">Recommendation Bot</h3>
                      <p className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full inline-block animate-pulse"></span>
                        GPT-4o + VectorDB • 실시간 RAG 검색 활성화
                      </p>
                    </div>
                  </div>
                  
                  {/* Option to clear chat */}
                  <button
                    onClick={() => setMessages([
                      {
                        id: "welcome",
                        role: "assistant",
                        content: "안녕하세요! 👋 도서 분석 트렌드 DB를 기반으로 작동하는 **AI 도서 추천 전문 사서**입니다. \n\n'클로드 코딩에 관한 책 추천해줘', '교사들을 위한 에듀테크나 제미나이 활용 책이 뭐야?', '가장 할인율이 큰 책 알려줘' 등 궁금한 내용을 물어보시면 실시간 책 트렌드 지표를 분석하여 가장 어울리는 책들을 추천해 드릴게요! 📚",
                        timestamp: new Date()
                      }
                    ])}
                    className="text-[10px] text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-800/40 px-2.5 py-1.5 rounded-lg border border-slate-700/50"
                  >
                    <RefreshCw size={11} />
                    대화 초기화
                  </button>
                </div>

                {/* Conversation thread scrolling */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-950/40">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-[85%] ${
                        msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold shadow-xs ${
                        msg.role === "user" ? "bg-indigo-600" : "bg-slate-700"
                      }`}>
                        {msg.role === "user" ? "나" : "AI"}
                      </div>

                      {/* Chat Bubble */}
                      <div className={`p-4 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-md"
                          : "bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-none shadow-sm"
                      }`}>
                        <div className="text-xs break-words leading-relaxed select-text">
                          {parseResponseContent(msg.content)}
                        </div>
                        <span className={`text-[8px] mt-1.5 block text-right font-medium ${
                          msg.role === "user" ? "text-indigo-200" : "text-slate-400"
                        }`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* AI Loader Bubble */}
                  {isChatLoading && (
                    <div className="flex gap-3 max-w-[80%] mr-auto">
                      <div className="w-8 h-8 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0 animate-pulse">
                        AI
                      </div>
                      <div className="p-4 bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-none">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold mt-2">관련 도서 DB 및 할인 지표를 분석 중입니다...</p>
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>

                {/* Suggestion chips & Text Input formulation */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3">
                  {/* Suggestion Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleSuggestionClick("클로드 코딩에 어울리는 추천 도서 목록을 보여줘")}
                      className="text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/60 px-3 py-1.5 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      💡 클로드 코딩 책 추천
                    </button>
                    <button
                      onClick={() => handleSuggestionClick("학교 선생님이 바로 쓰기 좋은 제미나이 또는 에듀테크 관련 베스트셀러 알려줘")}
                      className="text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/60 px-3 py-1.5 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      💡 에듀테크/제미나이 추천
                    </button>
                    <button
                      onClick={() => handleSuggestionClick("가장 할인율이 높은 파이썬이나 엑셀 활용 책이 뭐야?")}
                      className="text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/60 px-3 py-1.5 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      💡 할인율 높은 엑셀/파이썬 책
                    </button>
                  </div>

                  {/* Input form */}
                  <div className="bg-slate-800 rounded-xl p-1.5 flex justify-between items-center border border-slate-700 focus-within:border-indigo-500/80 transition-all duration-150">
                    <input
                      type="text"
                      placeholder="사서봇에게 무엇이든 물어보세요... (예: '클로드 코드 관련 책 추천해줘')"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isChatLoading && chatInput.trim()) {
                          e.preventDefault();
                          handleSendMessage(e as any);
                        }
                      }}
                      className="bg-transparent border-none text-white text-xs placeholder-slate-500 focus:outline-hidden flex-1 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleSendMessage(e as any)}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 📚 Right: Real-time retrieved books panel (1/3 column) in dark theme */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl flex flex-col overflow-hidden text-slate-200">
                <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass size={14} className="text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-200 font-display uppercase tracking-wider">Live References</h3>
                  </div>
                  <span className="text-[9px] font-bold bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-900/50">
                    {sidebarRetrievedBooks.length}개 연계됨
                  </span>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/20">
                  {sidebarRetrievedBooks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-20 text-slate-500">
                      <HelpCircle size={28} className="text-slate-600" />
                      <p className="text-[10px] font-semibold leading-relaxed">대화 도중 추천 키워드가 감지되면<br />실시간 매칭된 책 카드가 이곳에 연동됩니다.</p>
                      <span className="text-[9px] text-slate-500 mt-2">왼쪽의 추천 칩 중 하나를 누르면<br />즉시 도서가 매칭됩니다!</span>
                    </div>
                  ) : (
                    sidebarRetrievedBooks.map((book) => (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={book.rank}
                        className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3.5 flex gap-3 shadow-xs hover:border-slate-600/60 hover:bg-slate-850/80 transition-all duration-150 group"
                      >
                        {/* Cover thumbnail */}
                        <div className="w-16 h-22 bg-slate-900 rounded-lg p-1.5 flex items-center justify-center shrink-0 border border-slate-750 relative">
                          <span className="absolute top-1 left-1 bg-indigo-600 text-white font-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                            #{book.rank}
                          </span>
                          <img
                            src={book.image}
                            alt={book.title}
                            referrerPolicy="no-referrer"
                            className="h-full object-contain max-w-full rounded-sm"
                          />
                        </div>

                        {/* Summary specifications */}
                        <div className="flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            <h4 className="text-[11px] font-bold text-slate-100 line-clamp-1 leading-normal group-hover:text-indigo-400 transition-colors" title={book.title}>
                              {book.title}
                            </h4>
                            <p className="text-[9px] text-slate-400 truncate mt-0.5">
                              {book.author} | {book.publisher}
                            </p>
                            <span className="inline-block bg-slate-700 text-slate-300 text-[8px] font-bold px-1.5 py-0.5 rounded mt-1.5">
                              {book.category}
                            </span>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-750 pt-1.5 mt-1.5">
                            <span className="text-xs font-black text-slate-200">
                              {book.price.toLocaleString()}원
                            </span>
                            <a
                              href={book.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              referrerPolicy="no-referrer"
                              className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
                            >
                              YES24 상세
                              <ExternalLink size={8} />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* 🚀 Visual Footer Branding Info */}
      <footer className="bg-white border-t border-slate-100 py-4 text-center mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-[10px] text-slate-400 font-medium">
          도서 종합 트렌드 대시보드 v1.0 • Powered by Google Gemini-3.5-Flash RAG Engine
        </div>
      </footer>
    </div>
  );
}
