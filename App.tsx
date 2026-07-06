
import React, { useState, useEffect, useRef } from 'react';
import { 
  PlayCircle, Award, Wallet, Gift, X, CheckCircle, AlertCircle, 
  ChevronRight, Users, RotateCw, Sparkles, Target, Flame, 
  HelpCircle, Laugh, Star, Share2, Trophy, Swords, Shield,
  Calculator, Puzzle, Settings, PhoneCall, Globe, Eraser, History, Flag, Timer
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'trivia-earn-pro-demo';

const apiKey = ""; // Injected by environment
const POINTS_TO_KYAT_RATE = 10 / 3;
const MIN_WITHDRAW_KYAT = 1000;
const CATEGORIES = [
  { id: 'general', title: 'အထွေထွေ', icon: HelpCircle, color: 'from-blue-400 to-blue-600' },
  { id: 'buddhist', title: 'ဗုဒ္ဓဝင်', icon: History, color: 'from-amber-400 to-amber-600' },
  { id: 'math', title: 'သင်္ချာ', icon: Calculator, color: 'from-red-400 to-red-600' },
  { id: 'flags', title: 'အလံများ', icon: Flag, color: 'from-green-400 to-green-600' },
  { id: 'word_puzzle', title: 'စကားလုံးဆက်', icon: Puzzle, color: 'from-indigo-400 to-indigo-600' },
  { id: 'funny', title: 'ဟာသ', icon: Laugh, color: 'from-pink-400 to-pink-600' },
];

const DUMMY_LEADERBOARD = [
  { id: 'dummy1', name: 'Kyaw Kyaw', points: 15400, level: 31 },
  { id: 'dummy2', name: 'Su Su', points: 12300, level: 25 },
  { id: 'dummy3', name: 'Aung Min', points: 10500, level: 22 },
  { id: 'dummy4', name: 'Thida', points: 8900, level: 18 },
  { id: 'dummy5', name: 'Zayar', points: 7500, level: 16 },
  { id: 'dummy6', name: 'Nilar', points: 6100, level: 13 },
];

export default function TriviaEarnPro() {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  
  const [userName, setUserName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [points, setPoints] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  
  const [currentView, setCurrentView] = useState('home'); 
  const [leaderboard, setLeaderboard] = useState([]);
  const [showNotification, setShowNotification] = useState(null);
  const lastActionTime = useRef(0);

  const [regForm, setRegForm] = useState({ name: '', phone: '' });
  const [showConfirm, setShowConfirm] = useState(false);

  // Quiz States
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [selectedWord, setSelectedWord] = useState(''); 
  const [quizStatus, setQuizStatus] = useState('loading'); // loading, playing, answered, explanation
  const [questionsAnsweredInSession, setQuestionsAnsweredInSession] = useState(0);
  const [shuffledOptions, setShuffledOptions] = useState([]); 
  const [timeLeft, setTimeLeft] = useState(20);
  
  // Modals & Timers
  const [showAdModal, setShowAdModal] = useState(false);
  const [adCallback, setAdCallback] = useState(null);
  const [adTimeLeft, setAdTimeLeft] = useState(0);

  // Earn More States
  const [lastSpinTime, setLastSpinTime] = useState(0);
  const [lastScratchTime, setLastScratchTime] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDegree, setSpinDegree] = useState(0);
  const [scratchRevealed, setScratchRevealed] = useState(false);
  const [scratchReward, setScratchReward] = useState(0);

  const kyatBalance = Math.floor(points / POINTS_TO_KYAT_RATE);

  const recentWithdrawals = [
    "097***543 က 1000 Ks ထုတ်ယူသွားပါသည်",
    "099***122 က 3000 Ks ထုတ်ယူသွားပါသည်",
    "092***887 က 1500 Ks ထုတ်ယူသွားပါသည်",
    "094***990 က 5000 Ks ထုတ်ယူသွားပါသည်"
  ];

  const shuffleArray = (array) => {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Smart Answer Check for Word Puzzle (e.g., နေကြာ vs နေကြာပန်း)
  const checkAnswer = (userAns, correctAns, isPuzzle) => {
    if (!userAns) return false;
    if (userAns === correctAns) return true;
    if (isPuzzle) {
      // Remove common suffixes to see if the core word matches
      const cleanUser = userAns.replace(/ပန်း|ပင်|သီး|ရွက်|များ/g, '');
      const cleanCorrect = correctAns.replace(/ပန်း|ပင်|သီး|ရွက်|များ/g, '');
      return cleanUser === cleanCorrect && cleanUser.length > 0;
    }
    return false;
  };

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && db) {
        const docRef = doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'main');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().registered) {
          const data = docSnap.data();
          setPoints(data.points || 0);
          setUserLevel(data.level || 1);
          setUserName(data.name || '');
          setRegPhone(data.phone || '');
          setIsRegistered(true);
          setCurrentView('home');
        } else {
          setIsRegistered(false);
          setCurrentView('register');
        }
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db || !isRegistered) return;
    const lRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    const unsubscribe = onSnapshot(lRef, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Merge with dummy data if not enough real users
      if (data.length < 10) {
         const existingNames = data.map(d => d.name);
         const missingDummies = DUMMY_LEADERBOARD.filter(d => !existingNames.includes(d.name));
         data = [...data, ...missingDummies];
      }
      
      data.sort((a, b) => b.points - a.points);
      setLeaderboard(data.slice(0, 50)); 
    }, (error) => console.error("Leaderboard error:", error));
    return () => unsubscribe();
  }, [user, isRegistered]);

  const updateLeaderboard = async (uid, name, newPoints, level, phone) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', uid), {
        name: name,
        points: newPoints,
        level: level || 1,
        timestamp: Date.now()
      }, { merge: true });
      await setDoc(doc(db, 'artifacts', appId, 'users', uid, 'profile', 'main'), {
        points: newPoints,
        name: name,
        level: level || 1,
        phone: phone,
        registered: true
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const addPoints = async (amount) => {
    const now = Date.now();
    if (now - lastActionTime.current < 1500) {
      notify("လုပ်ဆောင်ချက်မြန်လွန်းနေပါသည်။ ခဏစောင့်ပါ။", "error");
      return;
    }
    lastActionTime.current = now;

    const newPoints = points + amount;
    const newLevel = Math.floor(newPoints / 500) + 1;
    
    setPoints(newPoints);
    setUserLevel(newLevel);
    
    if (user && isRegistered) {
      await updateLeaderboard(user.uid, userName, newPoints, newLevel, regPhone);
    }
    notify(`+${amount} Points ရရှိပါသည်!`, 'success');
  };

  const notify = (message, type = 'success') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 3000);
  };

  const handleRegisterClick = () => {
    if (!regForm.name || !regForm.phone) {
      notify('အချက်အလက်ပြည့်စုံစွာ ဖြည့်ပါ။', 'error'); return;
    }
    if (!regForm.phone.startsWith('09') || regForm.phone.length < 9) {
      notify('ဖုန်းနံပါတ် မှန်ကန်မှုမရှိပါ။', 'error'); return;
    }
    setShowConfirm(true);
  };

  const confirmRegister = async () => {
    if (user && db) {
       const newProfile = { name: regForm.name, phone: regForm.phone, registered: true, points: 0, level: 1 };
       try {
         await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), newProfile);
         setIsRegistered(true);
         setUserName(regForm.name);
         setRegPhone(regForm.phone);
         setCurrentView('home');
         setShowConfirm(false);
         notify('အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။');
       } catch (error) {
         notify('အကောင့်ဖွင့်ရာတွင် အမှားအယွင်းဖြစ်သွားပါသည်။', 'error');
       }
    }
  };

  const fetchQuestions = async (categoryObj) => {
    setQuizStatus('loading');
    setQuestions([]);
    setCurrentQIndex(0);
    setSelectedAnswer(null);
    setSelectedWord('');
    setQuestionsAnsweredInSession(0);
    setShuffledOptions([]);
    setTimeLeft(20);
    setCurrentView('quiz');

    let prompt = `You are a trivia quiz generator for a Myanmar app. Generate 5 UNIQUE and RANDOMLY SELECTED multiple-choice questions in Burmese (မြန်မာဘာသာ). Ensure questions do not repeat common trivia.
    Category: ${categoryObj.title}.
    Format as RAW JSON array:
    [{"question": "...", "options": ["...", "...", "...", "..."], "answer": "...", "explanation": "..."}]`;

    if (categoryObj.id === 'flags') {
      prompt += ` FOR FLAGS, "question" MUST be a single Emoji of a country flag (e.g. 🇲🇲). "options" must be 4 distinct country names in Burmese.`;
    } else if (categoryObj.id === 'word_puzzle') {
      prompt = `Generate 5 UNIQUE Word Puzzle questions in Burmese. Format as RAW JSON array.
      "question": Hint or definition of a specific Burmese word.
      "answer": The exact specific Burmese word (e.g. "နေကြာ").
      "options": Array of EXACTLY 10 single Burmese syllables. CRITICAL: MUST include the syllables of the answer, and random syllables. The random syllables MUST NOT form alternative related answers (e.g., if answer is နေကြာ, DO NOT include ပန်း).`;
    } else if (categoryObj.id === 'math') {
      prompt += ` FOR MATH, generate unique basic math problems in Burmese. Options are numbers.`;
    } else if (categoryObj.id === 'buddhist') {
      prompt += ` FOR BUDDHIST, generate unique questions about Buddhism or Buddha's life in Burmese.`;
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: "You must output valid JSON array." }] },
      generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
    };

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        parsed.forEach(q => {
          if (categoryObj.id !== 'word_puzzle') q.options = shuffleArray(q.options);
        });
        setQuestions(parsed);
        if (categoryObj.id === 'word_puzzle' && parsed.length > 0) {
           setShuffledOptions(shuffleArray(parsed[0].options));
        }
        setQuizStatus('playing');
        setTimeLeft(20);
      } else {
        throw new Error("No text generated");
      }
    } catch (err) {
      console.error(err);
      notify("မေးခွန်းထုတ်ရာတွင် အမှားအယွင်းဖြစ်သွားပါသည်။ ပြန်လည်ကြိုးစားပါ။", "error");
      setCurrentView('home');
    }
  };

  useEffect(() => {
    let timer;
    if (quizStatus === 'playing' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (quizStatus === 'playing' && timeLeft === 0) {
      handleAnswer(null); // Time Out
    }
    return () => clearInterval(timer);
  }, [quizStatus, timeLeft]);

  const handleAnswer = (optionOrWord) => {
    if (quizStatus !== 'playing') return;
    setSelectedAnswer(optionOrWord); // null means timeout
    setQuizStatus('answered');
    setTimeout(() => {
      setQuizStatus('explanation');
    }, 1000);
  };

  const proceedToNextQuestion = (pointsToAdd = 0) => {
    if (pointsToAdd > 0) addPoints(pointsToAdd);
    
    const answered = questionsAnsweredInSession + 1;
    setQuestionsAnsweredInSession(answered);

    const nextStep = () => {
      if (currentQIndex < questions.length - 1) {
        const nextIndex = currentQIndex + 1;
        setCurrentQIndex(nextIndex);
        setSelectedAnswer(null);
        setSelectedWord('');
        if (selectedCategory.id === 'word_puzzle') {
          setShuffledOptions(shuffleArray(questions[nextIndex].options));
        }
        setQuizStatus('playing');
        setTimeLeft(20);
      } else {
        fetchQuestions(selectedCategory);
      }
    };

    if (answered > 0 && answered % 5 === 0) {
      triggerAd(() => {
        notify("ကြော်ငြာကြည့်ရှုခြင်းအတွက် ကျေးဇူးတင်ပါသည်။", "success");
        nextStep();
      }, 5); 
    } else {
      nextStep();
    }
  };

  const triggerAd = (callback, adDuration = 5) => {
    setAdCallback(() => callback);
    setAdTimeLeft(adDuration);
    setShowAdModal(true);
  };

  useEffect(() => {
    let timer;
    if (showAdModal && adTimeLeft > 0) {
      timer = setInterval(() => setAdTimeLeft(prev => prev - 1), 1000);
    } else if (showAdModal && adTimeLeft === 0) {
      setShowAdModal(false);
      if (adCallback) {
        adCallback();
        setAdCallback(null);
      }
    }
    return () => clearInterval(timer);
  }, [showAdModal, adTimeLeft, adCallback]);

  const handleSpin = () => {
    const now = Date.now();
    if (now - lastSpinTime < 5 * 60 * 1000) {
      notify("၅ မိနစ်ပြည့်မှ ထပ်မံကစားနိုင်ပါမည်။", "error"); return;
    }
    triggerAd(() => {
      setIsSpinning(true);
      setSpinDegree(spinDegree + 1440 + Math.floor(Math.random() * 360)); 
      setTimeout(() => {
        setIsSpinning(false);
        setLastSpinTime(Date.now());
        const won = [2,3,4,5,10][Math.floor(Math.random() * 5)];
        addPoints(won);
        notify(`Spin မှ ${won} Points ရရှိပါသည်!`);
      }, 3000);
    });
  };

  const handleScratch = () => {
    const now = Date.now();
    if (now - lastScratchTime < 5 * 60 * 1000) {
      notify("၅ မိနစ်ပြည့်မှ ထပ်မံကစားနိုင်ပါမည်။", "error"); return;
    }
    triggerAd(() => {
      const won = Math.floor(Math.random() * 30) + 5;
      setScratchReward(won);
      setScratchRevealed(true);
      setLastScratchTime(Date.now());
      addPoints(won);
    });
  };

  const handleCopyCode = () => {
    const textToCopy = `REF-${user?.uid.substring(0,6).toUpperCase()}`;
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      notify('Link ကို Copy ကူးပြီးပါပြီ');
    } catch (err) {
      notify('Copy ကူးရန် မအောင်မြင်ပါ။', 'error');
    }
    document.body.removeChild(textArea);
  };

  const renderRegister = () => (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-gradient-to-br from-purple-700 to-indigo-800 p-4 text-white relative overflow-hidden">
      <div className="bg-white/10 p-3 rounded-full mb-4 backdrop-blur-sm border border-white/20">
        <Target size={48} className="text-yellow-400" />
      </div>
      <h1 className="text-3xl font-black mb-1">TriviaEarn</h1>
      <p className="text-purple-200 mb-6 text-sm text-center">ဉာဏ်စမ်းဖြေဆိုပြီး ငွေသားများ ထုတ်ယူကြစို့</p>

      <div className="w-full bg-white text-gray-800 rounded-3xl p-5 shadow-2xl">
        <h2 className="text-lg font-bold mb-4 text-center">အကောင့်သစ်ဖွင့်ရန်</h2>
        
        <div className="mb-3">
          <label className="block text-gray-700 font-bold mb-1 ml-1 text-xs">အမည်</label>
          <input 
            type="text" 
            value={regForm.name}
            onChange={(e) => setRegForm({...regForm, name: e.target.value})}
            placeholder="အမည်ရိုက်ထည့်ပါ"
            className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2.5 outline-none transition bg-gray-50 focus:bg-white text-sm"
          />
        </div>
        
        <div className="mb-5">
          <label className="block text-gray-700 font-bold mb-1 ml-1 text-xs">KPay / Wave ဖုန်းနံပါတ် (09...)</label>
          <input 
            type="tel" 
            value={regForm.phone}
            onChange={(e) => setRegForm({...regForm, phone: e.target.value.replace(/[^0-9]/g, '')})}
            placeholder="09..."
            className="w-full border-2 border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2.5 outline-none transition bg-gray-50 focus:bg-white text-sm"
            maxLength={11}
          />
        </div>

        <button 
          onClick={handleRegisterClick}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition text-sm"
        >
          အကောင့်ဖွင့်မည်
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm animate-zoom-in text-gray-800">
            <h3 className="text-lg font-bold mb-3">အချက်အလက် မှန်ကန်ပါသလား?</h3>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-200">
              <p className="text-gray-600 mb-1 text-sm">အမည်: <span className="font-bold text-gray-800 ml-2">{regForm.name}</span></p>
              <p className="text-gray-600 text-sm">ဖုန်း: <span className="font-bold text-gray-800 ml-2">{regForm.phone}</span></p>
            </div>
            <p className="text-[11px] text-red-500 mb-4 font-medium leading-relaxed">
              * မှတ်ချက်။ ဤဖုန်းနံပါတ်ဖြင့်သာ ငွေထုတ်ယူနိုင်မည်ဖြစ်ပြီး နောက်ပိုင်းတွင် ပြောင်းလဲ၍မရပါ။
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm">ပြင်ဆင်မည်</button>
              <button onClick={confirmRegister} className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-xl shadow-md transition text-sm">အတည်ပြုမည်</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMarquee = () => (
    <div className="bg-purple-900 text-purple-100 py-0.5 overflow-hidden relative flex items-center h-6 shrink-0">
       <style>{`
         @keyframes marqueeRTL { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
         .animate-marquee { display: inline-block; white-space: nowrap; animation: marqueeRTL 15s linear infinite; position: absolute; left: 0; }
       `}</style>
       <div className="animate-marquee text-[10px] font-medium flex gap-8">
         {recentWithdrawals.map((text, i) => (<span key={i}>💸 {text}</span>))}
       </div>
    </div>
  );

  const renderHeader = () => (
    <div className="flex flex-col shrink-0 z-20 shadow-sm bg-white">
      {renderMarquee()}
      <div className="flex justify-between items-center px-4 py-2 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <div className="bg-purple-600 p-1 rounded-lg flex items-center gap-1 text-white px-1.5">
            <Shield size={14} />
            <span className="font-bold text-[10px]">Lv {userLevel}</span>
          </div>
          <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-600">
            TriviaEarn
          </h1>
        </div>
        <div 
          className="flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-full cursor-pointer hover:bg-purple-100 transition border border-purple-200"
          onClick={() => setCurrentView('wallet')}
        >
          <Wallet size={14} className="text-purple-600" />
          <span className="font-bold text-xs text-purple-800">{kyatBalance} Ks</span>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="flex-1 overflow-y-auto no-scrollbar p-3 flex flex-col gap-3 pb-16">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md relative overflow-hidden shrink-0">
        <div className="absolute -right-4 -top-4 opacity-10"><Award size={100} /></div>
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-purple-200 text-xs mb-0.5">မင်္ဂလာပါ,</p>
            <h2 className="text-lg font-bold">{userName}</h2>
          </div>
        </div>
        <div className="mt-1">
          <div className="text-2xl font-black mb-1 tracking-tight flex items-center gap-1">
            {points} <Sparkles size={18} className="text-yellow-300" />
          </div>
          <p className="text-[11px] font-medium bg-white/20 inline-block px-2 py-0.5 rounded-full backdrop-blur-sm">
            ≈ {kyatBalance} ကျပ်
          </p>
        </div>
      </div>

      <div className="shrink-0">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <Target className="text-purple-600" size={16}/> ဉာဏ်စမ်း ဖြေဆိုရန်
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id}
              onClick={() => { setSelectedCategory(cat); fetchQuestions(cat); }}
              className={`bg-gradient-to-br ${cat.color} p-2 rounded-xl text-white shadow-sm hover:shadow-md transition active:scale-95 flex flex-col items-center text-center gap-1.5`}
            >
              <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm"><cat.icon size={18} /></div>
              <span className="font-semibold text-[10px] leading-tight">{cat.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pb-2 shrink-0">
        <h3 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1.5">
          <Gift className="text-purple-600" size={16}/> အပိုဆု နှင့် ပြိုင်ပွဲ
        </h3>
        <div className="flex flex-col gap-2">
          <button onClick={() => setCurrentView('tournament')} className="bg-gradient-to-r from-yellow-400 to-orange-500 p-2.5 rounded-xl flex items-center justify-between transition shadow-sm text-white active:scale-95">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full"><Swords size={16} /></div>
              <div className="text-left">
                <h4 className="font-bold text-sm leading-tight">နေ့စဉ် ပြိုင်ပွဲ</h4>
                <p className="text-[10px] text-yellow-100">အမှတ်များများရှာပြီး ဆုငွေယူပါ</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/70" />
          </button>
          <button onClick={() => setCurrentView('earn')} className="bg-white border border-purple-100 p-2.5 rounded-xl flex items-center justify-between transition shadow-sm active:scale-95">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-full"><RotateCw className="text-orange-500" size={16} /></div>
              <div className="text-left">
                <h4 className="font-bold text-sm text-gray-800 leading-tight">Spin & Scratch</h4>
                <p className="text-[10px] text-gray-500">ကံစမ်းမဲများမှ အခမဲ့ယူပါ</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
          <button onClick={() => setCurrentView('challenges')} className="bg-white border border-purple-100 p-2.5 rounded-xl flex items-center justify-between transition shadow-sm active:scale-95">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full"><Users className="text-blue-500" size={16} /></div>
              <div className="text-left">
                <h4 className="font-bold text-sm text-gray-800 leading-tight">Challenges & ဖိတ်ခေါ်ရန်</h4>
                <p className="text-[10px] text-gray-500">တာဝန်ထမ်းဆောင်ပြီး အမှတ်ယူပါ</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => {
    if (quizStatus === 'loading') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-purple-600 mb-3"></div>
          <h2 className="text-sm font-bold text-gray-700 animate-pulse">မေးခွန်းများ ပြင်ဆင်နေပါသည်...</h2>
        </div>
      );
    }

    const q = questions[currentQIndex];
    const isWordPuzzle = selectedCategory.id === 'word_puzzle';

    return (
      <div className="flex-1 flex flex-col p-4 w-full max-w-md mx-auto relative overflow-hidden bg-gray-50">
        <div className="flex justify-between items-center mb-2 shrink-0">
          <div className="bg-purple-100 px-2.5 py-1 rounded-full text-purple-700 font-bold text-[10px]">
            {selectedCategory.title}
          </div>
          <div className="font-bold text-gray-500 text-xs">{currentQIndex + 1} / 5</div>
          <button onClick={() => setCurrentView('home')} className="bg-gray-200 p-1 rounded-full hover:bg-gray-300">
            <X size={14} className="text-gray-600" />
          </button>
        </div>

        {/* Timer UI */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1 shrink-0 overflow-hidden">
           <div className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-purple-500'}`} style={{ width: `${(timeLeft / 20) * 100}%` }}></div>
        </div>
        <div className="flex justify-center mb-2 shrink-0">
           <span className={`text-xs font-bold flex items-center gap-1 ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}>
             <Timer size={12}/> {timeLeft}s
           </span>
        </div>

        {/* Question Area */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-3 flex flex-col items-center justify-center min-h-[90px] shrink-0 text-center">
           {isWordPuzzle ? (
             <div>
               <div className="text-[10px] font-bold text-indigo-500 mb-1">အောက်ပါအဓိပ္ပါယ်ရှိသော စကားလုံးကို ဆက်ပါ</div>
               <h2 className="text-sm font-bold text-gray-800 leading-relaxed">"{q.question}"</h2>
             </div>
           ) : selectedCategory.id === 'flags' ? (
             <div className="text-6xl">{q.question}</div>
           ) : (
             <h2 className="text-sm font-bold text-gray-800 leading-snug">{q.question}</h2>
           )}
        </div>

        {/* Options Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-2">
          {isWordPuzzle ? (
            <div className="flex flex-col gap-2 w-full h-full">
              <div className="bg-gray-50 border-2 border-indigo-100 min-h-[45px] rounded-xl flex items-center justify-center p-2 text-lg font-bold text-indigo-700 tracking-widest shadow-inner shrink-0">
                {selectedWord || <span className="text-gray-300 text-xs">အဖြေ ဖြည့်ပါ</span>}
              </div>
              
              <div className="grid grid-cols-5 gap-1.5 mt-1 shrink-0">
                {shuffledOptions.map((opt, i) => {
                  const isSelected = selectedWord.includes(opt) && selectedWord.length > 0;
                  return (
                    <button 
                      key={i} 
                      onClick={() => { if (quizStatus === 'playing') setSelectedWord(prev => prev + opt); }}
                      disabled={quizStatus !== 'playing'}
                      className={`border-2 p-2 rounded-lg text-sm font-bold transition active:scale-95 flex items-center justify-center
                        ${isSelected ? 'bg-indigo-100 border-indigo-300 text-indigo-400' : 'bg-white border-indigo-100 text-gray-800 shadow-sm'}
                      `}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-2 mt-auto pt-2 shrink-0">
                <button 
                  onClick={() => setSelectedWord('')}
                  disabled={quizStatus !== 'playing' || !selectedWord}
                  className="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-xl disabled:opacity-50 flex justify-center items-center gap-1.5 border border-red-200 text-xs"
                >
                  <Eraser size={14}/> ဖျက်မည်
                </button>
                <button 
                  onClick={() => handleAnswer(selectedWord)}
                  disabled={quizStatus !== 'playing' || !selectedWord}
                  className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-xl disabled:opacity-50 flex justify-center items-center gap-1.5 shadow-md text-xs"
                >
                  <CheckCircle size={14}/> အတည်ပြုမည်
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => {
                let btnClass = "bg-white border-2 border-gray-100 text-gray-700 font-medium py-3 px-3 rounded-xl text-left transition relative w-full shadow-sm text-[13px]";
                let icon = null;

                const isCorrectAns = checkAnswer(opt, q.answer, false);
                const isSelectedUserAns = opt === selectedAnswer;

                if (quizStatus === 'answered' || quizStatus === 'explanation') {
                  if (isCorrectAns) {
                    btnClass = "bg-green-50 border-2 border-green-500 text-green-800 font-bold py-3 px-3 rounded-xl text-left shadow-sm text-[13px]";
                    icon = <CheckCircle className="text-green-500 absolute right-3 top-1/2 -translate-y-1/2" size={16} />;
                  } else if (isSelectedUserAns) {
                    btnClass = "bg-red-50 border-2 border-red-500 text-red-800 font-bold py-3 px-3 rounded-xl text-left shadow-sm text-[13px]";
                    icon = <AlertCircle className="text-red-500 absolute right-3 top-1/2 -translate-y-1/2" size={16} />;
                  }
                } else if (isSelectedUserAns) {
                   btnClass = "bg-purple-50 border-2 border-purple-500 text-purple-800 font-bold py-3 px-3 rounded-xl text-left shadow-sm text-[13px]";
                }

                return (
                  <button key={i} onClick={() => handleAnswer(opt)} disabled={quizStatus !== 'playing'} className={btnClass}>
                    {opt} {icon}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Explanation */}
        {quizStatus === 'explanation' && (
          <div className="absolute inset-x-0 bottom-0 bg-white border-t-2 border-purple-100 rounded-t-3xl p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-20 animate-slide-up flex flex-col shrink-0">
            <div className="flex items-center gap-2 mb-2">
              {selectedAnswer === null ? (
                 <Timer className="text-red-500" size={18} />
              ) : checkAnswer(selectedAnswer, q.answer, isWordPuzzle) ? (
                <CheckCircle className="text-green-500" size={18} />
              ) : (
                <AlertCircle className="text-red-500" size={18} />
              )}
              <h3 className="font-bold text-gray-800 text-sm">
                 {selectedAnswer === null ? "အချိန်ကုန်သွားပါပြီ!" : checkAnswer(selectedAnswer, q.answer, isWordPuzzle) ? "အဖြေမှန်ပါသည်!" : "အဖြေမှားသွားပါသည်!"}
              </h3>
            </div>
            
            {!isWordPuzzle && (
              <p className="text-gray-600 mb-3 leading-snug bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-[11px]">
                <strong>ရှင်းလင်းချက်: </strong> {q.explanation}
              </p>
            )}
            {isWordPuzzle && !checkAnswer(selectedAnswer, q.answer, true) && (
               <p className="text-gray-600 mb-3 leading-snug bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-[11px]">
               <strong>အဖြေမှန်: </strong> {q.answer}
             </p>
            )}
            
            {checkAnswer(selectedAnswer, q.answer, isWordPuzzle) ? (
              <div className="flex gap-2">
                <button onClick={() => triggerAd(() => proceedToNextQuestion(10))} className="flex-1 bg-purple-600 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1 shadow-md text-xs">
                  <PlayCircle size={14} /> 2x Point (10)
                </button>
                <button onClick={() => proceedToNextQuestion(5)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-2 rounded-xl text-xs">
                  ကျော်မည် (5)
                </button>
              </div>
            ) : (
              <button onClick={() => proceedToNextQuestion(0)} className="w-full bg-purple-600 text-white font-bold py-2.5 rounded-xl shadow-md text-xs">
                နောက်တစ်ပုဒ်သို့
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderEarnMore = () => (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3 pb-16">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-bold text-gray-800">အပိုဆုများ</h2>
      </div>

      <div className="bg-white border border-purple-100 rounded-2xl p-4 text-center shadow-sm">
        <h3 className="font-bold text-sm mb-1 flex items-center justify-center gap-1">
           <RotateCw className="text-purple-500" size={16}/> Spin Wheel
        </h3>
        <p className="text-[10px] text-gray-500 mb-3">ကြော်ငြာကြည့်ပြီး ကံစမ်းမဲလှည့်ပါ</p>
        
        <div className="relative w-32 h-32 mx-auto mb-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 z-10 text-xl">👇</div>
          <div 
            className="w-full h-full rounded-full border-[3px] border-purple-200 overflow-hidden relative transition-transform duration-[3000ms] ease-out shadow-inner"
            style={{ 
              transform: `rotate(${spinDegree}deg)`,
              background: 'conic-gradient(#a855f7 0deg 60deg, #ec4899 60deg 120deg, #3b82f6 120deg 180deg, #10b981 180deg 240deg, #f59e0b 240deg 300deg, #ef4444 300deg 360deg)'
            }}
          >
             <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/30 transform -translate-x-1/2"></div>
             <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/30 transform -translate-y-1/2"></div>
             <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/30 transform -translate-x-1/2 rotate-45"></div>
             <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/30 transform -translate-x-1/2 -rotate-45"></div>
          </div>
        </div>

        <button onClick={handleSpin} disabled={isSpinning} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-2.5 rounded-xl transition shadow-md text-xs">
          {isSpinning ? 'လှည့်နေသည်...' : 'ကြော်ငြာကြည့်ပြီး လှည့်မည်'}
        </button>
      </div>

      <div className="bg-white border border-purple-100 rounded-2xl p-4 text-center shadow-sm">
        <h3 className="font-bold text-sm mb-1 flex items-center justify-center gap-1">
           <Sparkles className="text-pink-500" size={16}/> ခဲခြစ် ကံစမ်းမည်
        </h3>
        <div className="w-full h-20 relative bg-gray-200 rounded-xl overflow-hidden mb-3 flex items-center justify-center border-2 border-dashed border-gray-400 mt-2">
           {scratchRevealed ? (
             <div className="animate-zoom-in text-center">
               <p className="text-gray-500 font-medium mb-0.5 text-[10px]">ဂုဏ်ယူပါသည်!</p>
               <div className="text-xl font-black text-pink-600">+{scratchReward} Points</div>
             </div>
           ) : (
             <button onClick={handleScratch} className="w-full h-full absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-400 flex items-center justify-center text-white font-bold text-xs hover:bg-gray-500 transition">
                နှိပ်၍ ခဲခြစ်ပါ
             </button>
           )}
        </div>
        
        {scratchRevealed && (
          <button onClick={() => setScratchRevealed(false)} className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-xl transition text-xs">
            ပြန်လည်စတင်မည်
          </button>
        )}
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden pb-16">
      <div className="bg-purple-600 p-3 rounded-b-[20px] text-white shadow-md relative z-10 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-bold">Top 50 Leaderboard</h2>
        </div>
        <p className="text-purple-200 text-[10px]">အမှတ်အများဆုံး ကစားသမား ၅၀ စာရင်း</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 -mt-2 pt-4">
        <div className="flex flex-col gap-2">
          {leaderboard.map((u, i) => (
            <div key={u.id} className="bg-white p-2.5 rounded-xl flex items-center gap-3 shadow-sm border border-gray-100">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                i === 0 ? 'bg-yellow-100 text-yellow-600 border border-yellow-400' :
                i === 1 ? 'bg-gray-200 text-gray-600 border border-gray-300' :
                i === 2 ? 'bg-orange-100 text-orange-600 border border-orange-300' :
                'bg-purple-50 text-purple-600'
              }`}>
                {i + 1}
              </div>
              <div className="flex-grow">
                <h4 className="font-bold text-gray-800 text-xs">{u.name}</h4>
              </div>
              <div className="font-black text-purple-700 flex items-center gap-1 text-xs">
                {u.points} <span className="text-[9px] text-gray-400 font-normal">pts</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderWallet = () => (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col pb-16">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setCurrentView('home')} className="bg-gray-100 p-1.5 rounded-full hover:bg-gray-200">
          <ChevronRight size={16} className="rotate-180 text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">ငွေထုတ်ရန်</h2>
      </div>

      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-5 mb-4 text-center text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-2 -bottom-2 opacity-10">
          <Wallet size={80} />
        </div>
        <p className="text-purple-200 font-medium mb-1 text-xs">လက်ရှိ လက်ကျန်ငွေ</p>
        <div className="text-3xl font-black mb-2 tracking-tight">{kyatBalance} Ks</div>
        <p className="text-[10px] text-purple-200 bg-white/20 inline-block px-2 py-0.5 rounded-full backdrop-blur-sm">
          Balance: {points} Points
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 font-bold mb-1 ml-1 text-xs">
          KPay / WavePay ငွေထုတ်မည့် ဖုန်းနံပါတ်
        </label>
        <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-between">
          <span>{regPhone}</span>
          <Shield size={14} className="text-green-500" />
        </div>
        <p className="text-[10px] text-red-500 mt-1 ml-1 leading-relaxed font-medium">
          မှတ်ချက်။ ။ အကောင့်ဖွင့်စဉ်က အသုံးပြုခဲ့သော ဤဖုန်းနံပါတ်ဖြင့်သာ ငွေထုတ်ယူနိုင်ပါမည်။
        </p>
      </div>

      <button 
        onClick={() => {
          if (kyatBalance < MIN_WITHDRAW_KYAT) {
            notify(`အနည်းဆုံး ${MIN_WITHDRAW_KYAT} ကျပ် ပြည့်မှ ထုတ်ယူနိုင်ပါသည်။`, 'error');
            return;
          }
          notify("ငွေထုတ်ယူခြင်း အောင်မြင်ပါသည်။ 24 နာရီအတွင်း ရောက်ရှိပါမည်။");
          setPoints(0);
          setUserLevel(1);
          if(user) updateLeaderboard(user.uid, userName, 0, 1, regPhone);
          setCurrentView('home');
        }}
        className={`w-full font-bold py-3 rounded-xl transition shadow-md text-xs mt-auto ${
          kyatBalance >= MIN_WITHDRAW_KYAT 
            ? 'bg-purple-600 hover:bg-purple-700 text-white' 
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        ငွေထုတ်မည် (Min: {MIN_WITHDRAW_KYAT} Ks)
      </button>
    </div>
  );

  const renderChallenges = () => (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col pb-16">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setCurrentView('home')} className="bg-gray-100 p-1.5 rounded-full">
          <ChevronRight size={16} className="rotate-180 text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">Challenges</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-3">
        <div className="flex justify-between items-start mb-2">
           <div>
             <h3 className="font-bold text-blue-900 text-sm mb-0.5">သူငယ်ချင်း ဖိတ်ခေါ်ပါ</h3>
             <p className="text-blue-700 text-[10px]">သူငယ်ချင်းတစ်ယောက်အတွက် 50 Points</p>
           </div>
           <div className="bg-blue-100 p-1.5 rounded-full">
             <Share2 className="text-blue-600" size={16} />
           </div>
        </div>
        <div className="bg-white rounded-xl p-2.5 flex items-center justify-between shadow-sm border border-blue-100">
           <span className="font-mono text-gray-600 tracking-wider font-bold text-xs">REF-{user?.uid.substring(0,6).toUpperCase()}</span>
           <button onClick={handleCopyCode} className="text-blue-600 font-bold text-[10px] bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100">Copy</button>
        </div>
      </div>

      <h3 className="font-bold text-gray-800 mb-2 text-xs">နေ့စဉ် တာဝန်များ</h3>
      <div className="flex flex-col gap-2">
         <div className="bg-white p-2.5 rounded-xl flex items-center justify-between border border-gray-100 shadow-sm opacity-50">
           <div className="flex items-center gap-2">
             <div className="bg-green-100 p-1 rounded-full"><CheckCircle className="text-green-500" size={14}/></div>
             <div>
               <h4 className="font-bold text-gray-700 text-xs">App ကို ဖွင့်ပါ</h4>
               <p className="text-[9px] text-gray-500">+10 Points</p>
             </div>
           </div>
           <span className="text-[10px] font-bold text-green-600">ပြီးပြီ</span>
         </div>
         <div className="bg-white p-2.5 rounded-xl flex items-center justify-between border border-gray-100 shadow-sm">
           <div className="flex items-center gap-2">
             <div className="bg-orange-100 p-1 rounded-full"><Flame className="text-orange-500" size={14}/></div>
             <div>
               <h4 className="font-bold text-gray-700 text-xs">မေးခွန်း ၅၀ ဖြေပါ</h4>
               <p className="text-[9px] text-gray-500">0 / 50 (+50 Points)</p>
             </div>
           </div>
           <button className="bg-gray-100 text-gray-400 font-bold px-2 py-1 rounded-lg text-[10px] cursor-not-allowed">Claim</button>
         </div>
      </div>
    </div>
  );

  const renderTournament = () => (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col pb-16">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setCurrentView('home')} className="bg-gray-200 p-1.5 rounded-full hover:bg-gray-300 transition">
          <ChevronRight size={16} className="rotate-180 text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">နေ့စဉ် ပြိုင်ပွဲ</h2>
      </div>
      
      <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-2xl p-4 text-white shadow-md relative overflow-hidden mb-3">
         <div className="absolute -right-2 -bottom-2 opacity-20">
            <Trophy size={70} />
         </div>
         <h3 className="text-xl font-black mb-1">Summer Cup 🏆</h3>
         <p className="text-yellow-100 font-medium mb-2 text-[10px]">ယနေ့ ည ၁၂ နာရီ တွင် ပြီးဆုံးမည်</p>
         <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/30">
            <p className="text-[10px] mb-0.5">ပထမဆု - 100,000 Ks</p>
            <p className="text-[10px] mb-0.5">ဒုတိယဆု - 50,000 Ks</p>
            <p className="text-[10px]">တတိယဆု - 10,000 Ks</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center flex-grow flex flex-col justify-center">
         <Swords size={30} className="text-orange-500 mx-auto mb-2" />
         <h4 className="font-bold text-gray-800 text-sm mb-1">ယှဉ်ပြိုင်ရန် အဆင်သင့်ဖြစ်ပြီလား?</h4>
         <p className="text-gray-500 text-[10px] mb-4 leading-relaxed">ဝင်ကြေး 500 Points ပေးသွင်းပြီး ဝင်ရောက်ယှဉ်ပြိုင်ပါ။ မေးခွန်းအပုဒ် ၅၀ ဆက်တိုက်ဖြေဆိုရမည်ဖြစ်ပြီး အမှတ်အများဆုံးသူက အနိုင်ရရှိပါမည်။</p>
         
         <button onClick={() => notify("ပြိုင်ပွဲသို့ဝင်ရောက်ခြင်း ယခုလောလောဆယ် ပိတ်ထားပါသည်။", "error")} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl shadow-md transition text-xs">
            500 Points ဖြင့် ဝင်ပြိုင်မည်
         </button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col pb-16">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-gray-800">ဆက်တင် (Settings)</h2>
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-purple-50 p-3 rounded-xl flex items-center gap-2 mb-1 border border-purple-100 shadow-sm">
           <div className="bg-purple-200 p-2 rounded-full"><Users size={16} className="text-purple-700"/></div>
           <div>
              <h3 className="font-bold text-gray-800 text-sm">{userName}</h3>
              <p className="text-[10px] text-gray-500 font-medium">{regPhone}</p>
           </div>
        </div>

        <button 
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'TriviaEarn Pro', text: 'ဉာဏ်စမ်းဖြေရင်း ငွေရှာကြစို့!', url: window.location.href })
            } else {
              handleCopyCode();
            }
          }} 
          className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm active:bg-gray-50 transition"
        >
           <div className="bg-blue-100 p-1.5 rounded-lg"><Share2 size={14} className="text-blue-600"/></div>
           <span className="font-bold text-gray-700 flex-grow text-left text-xs">App ကို Share ရန်</span>
           <ChevronRight size={14} className="text-gray-400"/>
        </button>

        <button 
          onClick={() => notify("Customer Service: 09123456789 (Viber/Telegram သို့ဆက်သွယ်ပါ)", "success")} 
          className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm active:bg-gray-50 transition"
        >
           <div className="bg-green-100 p-1.5 rounded-lg"><PhoneCall size={14} className="text-green-600"/></div>
           <span className="font-bold text-gray-700 flex-grow text-left text-xs">Customer Service ဆက်သွယ်ရန်</span>
           <ChevronRight size={14} className="text-gray-400"/>
        </button>

        <button 
          onClick={() => notify("လောလောဆယ် မြန်မာဘာသာဖြင့်သာ အသုံးပြုနိုင်ပါသည်။", "success")} 
          className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm active:bg-gray-50 transition"
        >
           <div className="bg-orange-100 p-1.5 rounded-lg"><Globe size={14} className="text-orange-600"/></div>
           <span className="font-bold text-gray-700 flex-grow text-left text-xs">ဘာသာစကား (Language)</span>
           <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md">မြန်မာ</span>
        </button>
      </div>
    </div>
  );

  const renderAdOverlay = () => {
    if (!showAdModal) return null;
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center text-white">
        <div className="mb-4 text-center">
          <PlayCircle size={50} className="text-purple-500 mb-2 mx-auto animate-bounce" />
          <h2 className="text-xl font-black mb-1">ကြော်ငြာ ပြသနေသည်</h2>
          <p className="text-gray-400 text-xs">ကျေးဇူးပြု၍ ခဏစောင့်ပေးပါ။</p>
        </div>
        <div className="text-4xl font-black font-mono text-purple-400 mb-4">{adTimeLeft}s</div>
        <div className="w-40 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-linear"
            style={{ width: `${((adCallback ? 5 : 5) - adTimeLeft) * 20}%` }}
          />
        </div>
      </div>
    );
  };

  if (!isAuthReady) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-purple-600 mb-2"></div>
        <p className="font-bold text-gray-500 text-xs">Loading...</p>
      </div>
    );
  }

  if (!isRegistered) {
    return renderRegister();
  }

  return (
    <div className="h-[100dvh] w-full bg-gray-50 text-gray-800 font-sans flex flex-col items-center overflow-hidden">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        .animate-zoom-in { animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      
      <div className="w-full max-w-md bg-white h-full shadow-2xl relative flex flex-col overflow-hidden">
        {currentView !== 'quiz' && renderHeader()}
        
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {currentView === 'home' && renderHome()}
          {currentView === 'quiz' && renderQuiz()}
          {currentView === 'wallet' && renderWallet()}
          {currentView === 'earn' && renderEarnMore()}
          {currentView === 'leaderboard' && renderLeaderboard()}
          {currentView === 'settings' && renderSettings()}
          {currentView === 'challenges' && renderChallenges()}
          {currentView === 'tournament' && renderTournament()}
        </div>

        {currentView !== 'quiz' && (
          <div className="absolute bottom-0 left-0 w-full bg-white border-t border-purple-100 px-5 py-2 flex justify-between items-center z-10 shrink-0 shadow-[0_-5px_20px_-15px_rgba(0,0,0,0.2)]">
            <button onClick={() => setCurrentView('home')} className={`flex flex-col items-center gap-0.5 transition ${currentView === 'home' ? 'text-purple-600 scale-105' : 'text-gray-400 hover:text-purple-400'}`}>
              <Star size={18} className={currentView === 'home' ? 'fill-current' : ''}/>
              <span className="text-[9px] font-bold">Home</span>
            </button>
            <button onClick={() => setCurrentView('earn')} className={`flex flex-col items-center gap-0.5 transition ${currentView === 'earn' ? 'text-purple-600 scale-105' : 'text-gray-400 hover:text-purple-400'}`}>
              <Gift size={18} className={currentView === 'earn' ? 'fill-current' : ''}/>
              <span className="text-[9px] font-bold">Earn More</span>
            </button>
            <button onClick={() => setCurrentView('leaderboard')} className={`flex flex-col items-center gap-0.5 transition ${currentView === 'leaderboard' ? 'text-purple-600 scale-105' : 'text-gray-400 hover:text-purple-400'}`}>
              <Trophy size={18} className={currentView === 'leaderboard' ? 'fill-current' : ''}/>
              <span className="text-[9px] font-bold">Top 50</span>
            </button>
            <button onClick={() => setCurrentView('settings')} className={`flex flex-col items-center gap-0.5 transition ${currentView === 'settings' ? 'text-purple-600 scale-105' : 'text-gray-400 hover:text-purple-400'}`}>
              <Settings size={18} className={currentView === 'settings' ? 'fill-current' : ''}/>
              <span className="text-[9px] font-bold">Settings</span>
            </button>
          </div>
        )}

        {showNotification && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-[90%] max-w-xs z-50 animate-fade-in-up">
            <div className={`p-2.5 rounded-xl shadow-xl flex items-center gap-2 ${
              showNotification.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'
            }`}>
              {showNotification.type === 'error' ? <AlertCircle className="shrink-0" size={14} /> : <CheckCircle className="shrink-0 text-green-400" size={14} />}
              <p className="text-[11px] font-medium leading-snug">{showNotification.message}</p>
            </div>
          </div>
        )}

        {renderAdOverlay()}
      </div>
    </div>
  );
}
