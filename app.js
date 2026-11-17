/* 마주봄 웹앱 — 빌드 없이 동작하는 단일 페이지 앱
 * 데이터는 브라우저 localStorage에 저장됩니다 (체험/시연용).
 * 실제 운영 시에는 store 부분(load/save)을 Firebase·Supabase 등으로 교체하세요.
 */
(() => {
  const D = window.MAJUBOM;
  const KEY = 'majubom:v1';
  const app = document.getElementById('app');
  let db;
  let ui = {};
  let lastPath = null;
  let after = [];

  /* ---------------- utils ---------------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDay = (k) => { const d = fromKey(k); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`; };
  const ago = (ts) => {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
    const d = new Date(ts); return `${d.getMonth() + 1}.${d.getDate()}`;
  };
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const go = (p) => { location.hash = '#/' + p; };
  const st = () => (ui[cur.path] ||= {});
  async function sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('majubom:' + s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  let toastT;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function modal(html) {
    closeModal();
    const bg = document.createElement('div');
    bg.className = 'modal-bg'; bg.id = 'modal';
    bg.innerHTML = `<div class="modal">${html}</div>`;
    bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(); });
    document.body.appendChild(bg);
  }
  function closeModal() { document.getElementById('modal')?.remove(); }

  /* ---------------- store ---------------- */
  const me = () => db.users.find((u) => u.id === db.session);
  const user = (id) => db.users.find((u) => u.id === id) || { id: '_gone', nickname: '탈퇴한 회원', role: 'parent' };
  const bucket = (name) => ((db[name] ||= {})[db.session] ||= {});
  const commentCount = (id) => db.posts.reduce((n, p) => n + p.comments.filter((c) => c.authorId === id).length, 0);
  function gradeOf(id) {
    const c = commentCount(id);
    let g = D.grades[0];
    for (const x of D.grades) if (c >= x.min) g = x;
    const next = D.grades[D.grades.indexOf(g) + 1];
    return { ...g, count: c, next };
  }
  const isExpert = () => me()?.role === 'expert';
  function questionsToday(id) {
    const t = dkey();
    return db.questions.filter((q) => q.authorId === id && dkey(new Date(q.createdAt)) === t).length;
  }
  const dailyLimit = (id) => D.expertDailyLimit + (gradeOf(id).key !== 'seed' ? 1 : 0);

  async function seed() {
    const now = Date.now(), H = 3600e3, DD = 86400e3;
    const pw = await sha('1234');
    db = {
      v: 2, session: null,
      users: [
        { id: 'u_demo', username: 'demo', pw, nickname: '봄이맘', role: 'parent', childAge: '5세', createdAt: now - 12 * DD },
        { id: 'u_exp', username: 'expert', pw, nickname: '김마음', title: '발달심리 전문가', role: 'expert', createdAt: now - 40 * DD },
        { id: 'u_p2', username: 'sunny', pw, nickname: '햇살아빠', role: 'parent', childAge: '7세', createdAt: now - 20 * DD },
        { id: 'u_p3', username: 'tori', pw, nickname: '토리엄마', role: 'parent', childAge: '4세', createdAt: now - 18 * DD },
        { id: 'u_p4', username: 'eunwoo', pw, nickname: '은우엄마', role: 'parent', childAge: '8세', senior: true, createdAt: now - 90 * DD },
        { id: 'u_p5', username: 'haneul', pw, nickname: '하늘맘', role: 'parent', childAge: '6세', createdAt: now - 25 * DD },
        { id: 'u_p6', username: 'kong', pw, nickname: '콩이아빠', role: 'parent', childAge: '7세', createdAt: now - 15 * DD },
      ],
      posts: [
        { id: 'p1', authorId: 'u_p2', cat: '일상 나눔', title: '오늘 아이가 먼저 손을 잡아줬어요', createdAt: now - 3 * H, likes: ['u_p3', 'u_demo'],
          body: '4차시에서 배운 “아이가 이끄는 놀이”를 일주일째 해보고 있어요.\n오늘 놀이터에서 아이가 먼저 제 손을 잡고 미끄럼틀로 데려갔는데, 별것 아닌 일인데도 눈물이 났네요. 다들 오늘 하루도 고생 많으셨어요.',
          comments: [
            { id: 'c1', authorId: 'u_p3', body: '읽는 저도 울컥하네요. 정말 큰 순간이에요 🥹', createdAt: now - 2 * H },
            { id: 'c2', authorId: 'u_demo', body: '저도 그 놀이 해봐야겠어요. 공유해주셔서 감사해요!', createdAt: now - 1.5 * H },
          ] },
        { id: 'p2', authorId: 'u_p3', cat: '질문', title: '감각이 예민한 아이, 미용실 어떻게 가시나요?', createdAt: now - 26 * H, likes: ['u_p2'],
          body: '머리 자를 때마다 너무 힘들어해서 고민이에요. 소리랑 촉감 둘 다 예민한 편이에요. 경험 있으신 분들 팁 부탁드려요.',
          comments: [
            { id: 'c3', authorId: 'u_demo', body: '저희는 집에서 이발기 소리를 미리 들려주고, 좋아하는 영상 보면서 잘라요. 조금 나아졌어요.', createdAt: now - 22 * H },
            { id: 'c4', authorId: 'u_p2', body: '한산한 평일 오전 시간에 가면 훨씬 수월했어요!', createdAt: now - 20 * H },
          ] },
        { id: 'p3', authorId: 'u_demo', cat: '응원', title: '이번 주도 다들 버텨주셔서 고마워요', createdAt: now - 3 * DD, likes: ['u_p2', 'u_p3'],
          body: '치료실 다니랴, 일하랴 정신없는 한 주였는데 여기 들어오면 혼자가 아닌 것 같아 위로가 돼요. 우리 이번 주말엔 나를 위한 차 한 잔 꼭 마셔요 ☕',
          comments: [
            { id: 'c5', authorId: 'u_p3', body: '맞아요, 여기가 제 숨구멍이에요.', createdAt: now - 2.8 * DD },
            { id: 'c6', authorId: 'u_demo', body: '토리엄마님도 화이팅이에요!', createdAt: now - 2.7 * DD },
          ] },
      ],
      questions: [
        { id: 'q1', authorId: 'u_demo', field: '감각', childAge: '5세', public: true, createdAt: now - 2 * DD,
          situation: '양치할 때마다 크게 울고 몸을 뒤로 젖혀요. 칫솔이 입에 닿기만 해도 거부해요.',
          question: '억지로라도 해야 할지, 다른 방법이 있을지 궁금합니다.',
          answer: { expertId: 'u_exp', createdAt: now - 1.6 * DD,
            body: '어머님, 매일 그 시간이 얼마나 힘드실지 느껴져요. 입안 감각이 예민한 아이들에게 흔한 모습이에요.\n\n1) 양치 전 손가락이나 부드러운 실리콘 칫솔로 볼·입술 주변을 가볍게 눌러 주는 “준비 터치”를 해 보세요.\n2) 거울 앞에서 아이가 직접 칫솔을 쥐게 하고, 부모는 손을 살짝 얹어 함께 움직여 주세요.\n3) 노래 한 곡(약 1분) 동안만 하는 식으로 끝이 보이게 해 주면 예측 가능성이 높아져요.\n\n2주 정도 해 보시고 변화가 없으면 다시 남겨 주세요.' } },
        { id: 'q2', authorId: 'u_p3', field: '언어·의사소통', childAge: '4세', public: true, createdAt: now - 5 * H,
          situation: '원하는 게 있으면 말 대신 제 손을 끌고 가요.', question: '말을 하도록 유도하려면 어떻게 하면 좋을까요?', answer: null },
      ],
      assess: {}, quiz: {}, lessons: { u_demo: { watched: {}, done: { 1: true, 2: true } } },
      checklist: { u_demo: { items: [...D.defaultChecklist], log: {} } },
      emotions: { u_demo: {} }, prefs: {}, rulesSeen: {},
    };
    const P = (id, a, cat, title, body, hAgo, likes, comments) => ({ id, authorId: a, cat, title, body, createdAt: now - hAgo * H, likes,
      comments: comments.map(([ca, cb, ch], i) => ({ id: `${id}c${i}`, authorId: ca, body: cb, createdAt: now - ch * H })) });
    db.posts[0].comments.push({ id: 'c1b', authorId: 'u_p4', body: '저도 그 순간 아직도 기억나요. 앞으로 이런 날이 점점 많아질 거예요 🌸', createdAt: now - 1 * H });
    db.posts[1].comments.push({ id: 'c4b', authorId: 'u_p4', body: '저희 아이는 귀마개(이어머프) 쓰고 가니 훨씬 나았어요. 미용사분께 미리 특성을 말씀드리는 것도 도움 됐고요.', createdAt: now - 19 * H });
    db.posts[2].comments.push({ id: 'c6b', authorId: 'u_p4', body: '이번 주도 정말 수고 많으셨어요. 차 한 잔 꼭 드세요 ☕', createdAt: now - 2.5 * DD });
    db.posts.push(
      P('p4', 'u_p4', '정보', '[선배맘 팁] 진단 직후 제가 가장 도움받았던 3가지', '벌써 진단받은 지 4년이 됐네요. 처음엔 뭘 해야 할지 몰라 막막했는데, 돌아보면 이 세 가지가 가장 도움이 됐어요.\n\n1. 지역 발달장애인지원센터에 먼저 연락하기 — 바우처, 치료 기관 정보를 한 번에 안내받을 수 있어요.\n2. 아이 관찰 노트 쓰기 — 치료 선생님과 상담할 때 정말 유용해요.\n3. 나를 위한 시간 정해두기 — 일주일에 한 시간이라도요.\n\n궁금한 거 있으시면 편하게 물어보세요!', 30, ['u_p2', 'u_p3', 'u_p5', 'u_p6', 'u_demo'],
        [['u_p3', '저장해두고 계속 볼게요. 감사해요!', 28], ['u_p5', '2번 관찰 노트 오늘부터 시작해볼게요.', 26], ['u_p6', '선배님 글 볼 때마다 힘이 납니다.', 20], ['u_p4', '다들 잘하고 계세요. 천천히 가도 괜찮아요 💜', 18]]),
      P('p5', 'u_p5', '질문', '어린이집 선생님께 아이 특성 어떻게 설명하시나요?', '이번에 어린이집을 옮기게 됐는데, 아이 특성을 어디까지, 어떻게 말씀드려야 할지 고민이에요. 너무 많이 말하면 편견이 생길까 걱정되고요.', 50, ['u_p3'],
        [['u_p4', '저는 “이럴 때 이렇게 해주시면 좋아요” 식으로 한 장짜리 안내문을 만들어 드렸어요. 선생님들이 오히려 고마워하셨어요.', 47], ['u_p4', '좋아하는 것, 싫어하는 감각, 진정 방법 세 가지만 적어도 충분해요.', 46], ['u_p2', '은우엄마님 방법 좋네요. 저도 따라 해봐야겠어요.', 40]]),
      P('p6', 'u_p6', '일상 나눔', '주말 아빠 육아, 오늘은 버블 놀이 성공!', '활동놀이키트에 있던 버블 놀이 해봤어요. 평소엔 5분도 집중 못하는데 오늘은 20분 넘게 같이 놀았어요. 아이가 “또!” 하고 말해줘서 너무 기뻤습니다.', 8, ['u_p2', 'u_p4', 'u_p5'],
        [['u_p4', '“또!” 정말 큰 표현이에요. 축하드려요 👏', 7], ['u_p3', '저희도 이번 주말에 해볼게요!', 6], ['u_p4', '비눗방울 터뜨리기 전에 잠깐 기다려 주면 요구 표현도 늘어나요.', 5]]),
      P('p7', 'u_p3', '응원', '진단받은 지 한 달, 아직도 매일 울어요', '다들 처음엔 어떻게 버티셨어요? 아이 앞에서는 웃으려고 하는데 혼자 있으면 눈물이 나요. 제가 너무 약한 엄마인가 싶어요.', 70, ['u_p2', 'u_p4', 'u_p5', 'u_p6', 'u_demo'],
        [['u_p4', '전혀 약한 게 아니에요. 저도 첫 반년은 매일 울었어요. 우는 것도 받아들이는 과정이래요.', 68], ['u_p5', '저도 그랬어요. 토리엄마님 혼자 아니에요.', 66], ['u_p2', '1차시 때 배운 감정 기록 해보시면 조금 정리가 돼요.', 60], ['u_exp', '지금 느끼시는 감정은 자연스러운 과정이에요. 너무 힘드실 땐 전문가 게시판에 마음을 남겨 주세요. 함께 이야기 나눠요.', 58], ['u_p6', '응원합니다. 우리 같이 버텨봐요.', 55], ['u_p4', '울고 나서 따뜻한 차 한 잔, 꼭 해보세요 🍵', 50]]),
      P('p8', 'u_p4', '정보', '치료실 대기 시간 활용법 (엄마 쉼표 버전)', '치료실 대기 40분, 예전엔 휴대폰만 보다가 더 지쳤는데 요즘은 이렇게 보내요.\n- 10분: 마음 쉼표 스트레칭\n- 20분: 오늘 감정 기록 + 관찰 노트\n- 10분: 좋아하는 노래 듣기\n작은 루틴이 생기니 덜 지치더라고요.', 100, ['u_p3', 'u_p5'],
        [['u_p5', '대기 시간을 이렇게 쓸 수 있군요!', 98], ['u_p3', '저도 노래 듣기부터 해볼게요.', 90], ['u_p4', '네, 5분이라도 나를 위해 쓰면 달라져요.', 88]]),
      P('p9', 'u_p2', '질문', '형제자매에게 동생의 장애를 어떻게 설명하셨어요?', '첫째가 9살인데 “동생은 왜 말을 안 해?”라고 자주 물어요. 어떻게 설명해야 상처받지 않고 이해할 수 있을까요?', 120, ['u_p4'],
        [['u_p4', '저는 “동생은 말 대신 다른 방법으로 이야기해”라고 시작했어요. 동생의 표현을 같이 찾아보는 놀이를 했더니 좋아하더라고요.', 115], ['u_p5', '관련 그림책도 도움이 됐어요.', 110], ['u_p6', '첫째만의 시간을 따로 챙겨주는 것도 중요하더라고요.', 100]]),
      P('p10', 'u_p5', '일상 나눔', '3차시 숏폼 보고 놀이 방식을 바꿔봤어요', '아이가 블록을 줄 세우기만 해서 늘 다르게 놀게 하려고 했는데, 숏폼 보고 아이 방식대로 같이 줄을 세워봤어요. 처음으로 아이가 저를 쳐다보며 웃었어요.', 20, ['u_p4', 'u_p6'],
        [['u_p4', '아이 세계에 들어가 눈맞춤, 2차시 내용 그대로네요! 멋져요.', 18], ['u_p3', '저도 따라 해볼게요 😊', 15]]),
      P('p11', 'u_p6', '정보', '집에서 하는 감각 놀이 재료 추천', '저렴하게 집에서 할 수 있는 감각 놀이 재료 공유해요.\n- 쌀/콩 촉감 상자\n- 물풀 + 반짝이 슬라임\n- 키친타월 심 소리 통\n아이마다 좋아하는 감각이 달라서 하나씩 시도해 보세요.', 140, ['u_p3', 'u_p5', 'u_demo'],
        [['u_p4', '콩 촉감 상자 강추예요. 대신 삼키지 않게 꼭 옆에서 봐주세요!', 138], ['u_p5', '키친타월 소리 통 아이디어 좋네요.', 130], ['u_p2', '바로 만들어 봤어요. 고마워요!', 125]]),
      P('p12', 'u_p4', '응원', '오늘 힘든 분들, 여기에 한 줄씩 남겨요', '오늘 하루 힘들었던 분들, 여기에 딱 한 줄만 남기고 가세요. 서로 토닥여 드려요 💜', 4, ['u_p2', 'u_p3', 'u_p5', 'u_p6'],
        [['u_p5', '오늘 치료실 두 군데 다녀왔어요. 지쳤지만 버텼어요.', 3.5], ['u_p3', '아이가 밥을 안 먹어서 속상했어요.', 3], ['u_p6', '야근하고 들어왔는데 아이가 자고 있네요. 내일은 꼭 놀아줄게.', 2.5], ['u_p4', '다들 오늘도 충분히 잘하셨어요. 푹 쉬세요 🌙', 2]]),
    );
    const Q = (id, a, field, age, situation, question, hAgo, pub, ans) => ({ id, authorId: a, field, childAge: age, situation, question, public: pub, createdAt: now - hAgo * H,
      answer: ans ? { expertId: 'u_exp', body: ans[0], createdAt: now - ans[1] * H } : null });
    db.questions.push(
      Q('q3', 'u_p5', '행동', '6세', '마트에만 가면 바닥에 눕고 소리를 질러요. 사람들 시선 때문에 저도 당황해서 매번 급하게 나오게 돼요.', '마트 같은 공공장소에서 어떻게 대처하면 좋을까요?', 30, true,
        ['많이 당황스러우셨죠. 마트는 소리·빛·사람이 많아 감각적으로 힘든 공간일 수 있어요.\n\n1) 가기 전에 그림이나 사진으로 “마트 → 우유 사기 → 집”처럼 순서를 보여 주세요.\n2) 처음엔 5분짜리 짧은 방문으로 성공 경험을 만들어요.\n3) 아이가 힘들어하면 조용한 곳으로 잠시 이동해 진정할 시간을 주세요. 이때 훈육보다 안전과 진정이 먼저예요.\n\n주변 시선보다 아이와 어머님의 안정이 더 중요해요.', 22]),
      Q('q4', 'u_p6', '일상생활', '7세', '배변 훈련을 1년 전에 시도했다가 아이가 너무 힘들어해서 멈췄어요.', '다시 시도해도 될 시기인지, 어떻게 시작하면 좋을지 궁금합니다.', 60, true,
        ['다시 시도하실 수 있어요. 아이가 기저귀가 젖었을 때 불편함을 표현하거나, 2시간 정도 마른 상태를 유지한다면 좋은 신호예요.\n\n- 화장실 가는 시간을 정해 일과표에 그림으로 넣어 주세요.\n- 변기에 앉는 것만으로도 칭찬해 주세요. 성공보다 “앉기”가 첫 목표예요.\n- 실수했을 때는 담담하게 정리해 주세요.\n\n2~3주 진행 후 기록을 남겨 주시면 다시 피드백 드릴게요.', 50]),
      Q('q5', 'u_p2', '학교·기관', '7세', '내년에 초등학교 입학인데 특수학급과 통합학급 중 고민이에요.', '어떤 기준으로 선택하면 좋을까요?', 10, true, null),
      Q('q6', 'u_p4', '부모 마음', '8세', '다 지나간 줄 알았는데 최근 아이가 퇴행하는 모습을 보이면서 다시 마음이 무너져요.', '이런 마음이 반복되는 게 정상인가요?', 80, true,
        ['네, 정말 자연스러운 일이에요. 장애 수용은 한 번에 끝나는 계단이 아니라 오르내리는 과정이에요. 아이의 새로운 시기마다 마음이 다시 흔들릴 수 있어요.\n\n지금까지 걸어오신 길을 떠올려 보세요. 그동안 쌓아온 힘은 사라지지 않아요. 감정 기록으로 지금의 마음을 적어 보시고, 필요하시면 상담도 연결해 드릴게요.', 70]),
      Q('q7', 'u_p3', '감각', '4세', '옷 라벨, 양말 솔기를 너무 싫어해서 아침마다 옷 입히는 데 30분이 넘게 걸려요.', '감각이 예민한 아이 옷 입히기 팁이 있을까요?', 3, true, null),
    );
    const moods = ['good', 'normal', 'hard', 'normal', 'good', 'good', 'hard', 'normal', 'good'];
    const memos = ['아이랑 산책하며 웃었다.', '', '치료실 대기 시간이 길어 지쳤다.', '', '처음으로 혼자 숟가락질 성공!', '', '밤에 잠을 못 자서 예민했던 하루', '', ''];
    [1, 2, 4, 5, 7, 8, 10, 13, 15].forEach((n, i) => {
      db.emotions.u_demo[dkey(addDays(new Date(), -n))] = { mood: moods[i], memo: memos[i], shared: i === 2, ts: now - n * DD };
    });
    [1, 2, 3, 5, 6, 8, 9, 11, 12, 14].forEach((n, i) => {
      db.checklist.u_demo.log[dkey(addDays(new Date(), -n))] = [true, i % 3 !== 0, i % 2 === 0];
    });
    save();
  }

  async function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
    if (!db || db.v !== 2) await seed();
  }

  /* ---------------- layout pieces ---------------- */
  const TABS = [['home', '🏠', '홈'], ['learn', '📖', '학습'], ['community', '💬', '커뮤니티'], ['record', '📝', '기록'], ['my', '🌱', '마이']];
  const tabbar = (on) => `<nav class="tabbar">${TABS.map(([k, i, l]) => `<a href="#/${k}" class="${on === k ? 'on' : ''}"><span class="i">${i}</span>${l}</a>`).join('')}</nav>`;
  const top = (title, back, right = '') => `<header class="topbar">${back ? `<a class="back" href="#/${back}" aria-label="뒤로">‹</a>` : ''}<h1>${title}</h1>${right}</header>`;
  const brandTop = (right = '') => `<header class="topbar"><div class="brand"><img src="assets/images/login_logo.png" alt="">마주봄</div>${right}</header>`;
  const avatar = (u) => `<span class="avatar">${u.role === 'expert' ? '🩺' : `<img src="${gradeOf(u.id).img}" alt="">`}</span>`;
  const authorLine = (u, ts) => `<div class="author">${avatar(u)}<span>${esc(u.nickname)}</span>${u.role === 'expert' ? '<span class="chip green">전문가</span>' : `<span class="chip">${gradeOf(u.id).name}</span>${u.senior ? '<span class="chip rose">선배 부모</span>' : ''}`}<span class="muted">· ${ago(ts)}</span></div>`;
  const moodOf = (k) => D.moods.find((m) => m.key === k);
  const empty = (msg, img = 'assets/images/seed_mascot.png') => `<div class="empty"><img src="${img}" alt="">${msg}</div>`;

  /* ---------------- views: auth ---------------- */
  function vLogin() {
    return `<div class="auth">
      <div class="logo-wrap"><div class="logo-glow"><img src="assets/images/login_logo.png" alt="마주봄 로고"></div></div>
      <h1>마주봄</h1>
      <p class="tagline">아이와 마주 보고, 나와 마주 보는 시간</p>
      <form data-form="login" class="col">
        <input class="input" name="username" placeholder="아이디" autocomplete="username" required>
        <input class="input" type="password" name="password" placeholder="비밀번호" autocomplete="current-password" required>
        <button class="btn block" type="submit">로그인</button>
      </form>
      <div class="links"><button type="button" data-act="forgot" class="muted">아이디/비밀번호 찾기</button> &nbsp;|&nbsp; <a href="#/signup">회원가입</a></div>
      <div class="demo-box">처음이신가요? 체험 계정으로 둘러보기<br>
        <button type="button" data-act="demo" data-u="demo">부모님으로</button> · <button type="button" data-act="demo" data-u="expert">전문가로</button></div>
    </div>`;
  }
  function vSignup() {
    const s = st(); s.role ||= 'parent';
    return `${top('회원가입', 'login')}
    <form data-form="signup" class="page">
      <div class="seg">
        <button type="button" data-act="setRole" data-v="parent" class="${s.role === 'parent' ? 'on' : ''}">부모님</button>
        <button type="button" data-act="setRole" data-v="expert" class="${s.role === 'expert' ? 'on' : ''}">전문가</button>
      </div>
      <div class="field"><label>아이디</label><input class="input" name="username" required minlength="3" autocomplete="username" placeholder="영문/숫자 3자 이상"></div>
      <div class="field"><label>비밀번호</label><input class="input" type="password" name="password" required minlength="4" autocomplete="new-password" placeholder="4자 이상"></div>
      <div class="field"><label>닉네임</label><input class="input" name="nickname" required maxlength="12" placeholder="커뮤니티에 보여질 이름 (실명 X)"></div>
      ${s.role === 'parent'
        ? `<div class="field"><label>자녀 연령</label><input class="input" name="childAge" placeholder="예: 5세"></div>`
        : `<div class="field"><label>전문 분야</label><input class="input" name="title" placeholder="예: 언어치료사"></div>
           <div class="field"><label>전문가 인증 코드</label><input class="input" name="code" required placeholder="운영진에게 받은 코드"></div>`}
      <div class="card col" style="gap:10px">
        <label class="row" style="align-items:flex-start"><input type="checkbox" required style="margin-top:4px"><span class="grow" style="font-size:14px">[필수] 개인정보 수집·이용에 동의합니다.</span><a href="#/privacy" class="muted small">보기</a></label>
        <label class="row" style="align-items:flex-start"><input type="checkbox" required style="margin-top:4px"><span class="grow" style="font-size:14px">[필수] 커뮤니티 이용규칙을 지키겠습니다.</span><a href="#/rules/community" class="muted small">보기</a></label>
        <label class="row" style="align-items:flex-start"><input type="checkbox" name="optional" style="margin-top:4px"><span class="grow" style="font-size:14px">[선택] 프로그램 개선을 위한 기록 활용에 동의합니다.</span></label>
      </div>
      <button class="btn block" type="submit">가입하기</button>
    </form>`;
  }

  /* ---------------- views: home ---------------- */
  function vHome() {
    const u = me();
    if (u.role === 'expert') return vHomeExpert(u);
    const g = gradeOf(u.id);
    const today = bucket('emotions')[dkey()];
    const assess = bucket('assess');
    const aDone = Object.keys(D.assessments).filter((k) => assess[k]).length;
    const done = bucket('lessons').done || {};
    const next = D.sessions.find((s) => !done[s.n]);
    const care = D.care[Math.floor(Date.now() / 864e5) % D.care.length];
    const cl = bucket('checklist');
    const clToday = (cl.log?.[dkey()] || []).filter(Boolean).length;
    const now = new Date();
    const pct = g.next ? Math.round(((g.count - g.min) / (g.next.min - g.min)) * 100) : 100;
    return `${brandTop(`<a class="icon-btn" href="#/care" aria-label="마음 쉼표">🔔</a>`)}
    <div class="page">
      <div class="hello"><h2>${esc(u.nickname)}님, 오늘도 반가워요</h2><p>${now.getMonth() + 1}월 ${now.getDate()}일 · 천천히, 나의 속도로 가요</p></div>
      ${aDone < 3 ? `<a href="#/assess" class="card yellow row"><span style="font-size:28px">📝</span><div class="grow"><h3>사전 검사를 먼저 해 주세요</h3><p class="muted">${aDone}/3 완료 · 약 7분이면 끝나요</p></div><span class="arrow">›</span></a>` : ''}
      <a href="#/my" class="card grade-card">
        <div class="mascot"><img src="${g.img}" alt="${g.name}"></div>
        <div class="grow col" style="gap:6px">
          <div class="row" style="gap:6px"><span class="chip green">${g.name} 등급</span><span class="muted small">댓글 ${g.count}개</span></div>
          <b style="font-size:15px">${g.next ? `‘${g.next.name}’까지 댓글 ${g.next.min - g.count}개 남았어요` : '활짝 핀 꽃이 되었어요! 🌸'}</b>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <div class="grade-steps">${D.grades.map((x) => `<span>${x.key === g.key ? `<b>${x.name}</b>` : x.name}</span>`).join('')}</div>
        </div>
      </a>
      <div class="section-title"><h2>오늘의 마음은 어때요?</h2><a href="#/emotion">${today ? '메모 남기기 ›' : '기록 보기 ›'}</a></div>
      <div class="mood-quick">${D.moods.map((m) => `<button class="mood-btn ${today?.mood === m.key ? 'on' : ''}" data-act="quickMood" data-m="${m.key}"><img src="${m.img}" alt="">${m.label}</button>`).join('')}</div>
      ${next ? `<a href="#/lesson/${next.n}" class="card tint next-session">
        <div class="num"><b>${next.n}</b>차시</div>
        <div class="grow"><span class="chip" style="background:rgba(255,255,255,.25);color:#fff">${next.type}</span><h3 style="margin:6px 0 2px">${esc(next.title)}</h3><p style="opacity:.85;font-size:13px">${esc(next.sub)}</p></div><span style="font-size:22px">›</span>
      </a>` : `<div class="card green"><h3>🎉 6차시를 모두 마쳤어요</h3><p class="muted">4주 후 추적평가 전까지 기록을 이어가 보세요.</p></div>`}
      <div class="grid2">
        <a href="#/lesson/3" class="shortcut"><span class="ico">🎬</span><b>온라인 강의</b><span>3차시 사전 학습</span></a>
        <a href="#/learn" class="shortcut"><span class="ico">✏️</span><b>차시별 퀴즈</b><span>3·4차시 복습</span></a>
        <a href="#/expert" class="shortcut"><span class="ico">🩺</span><b>전문가 질문</b><span>오늘 ${Math.max(0, dailyLimit(u.id) - questionsToday(u.id))}회 남음</span></a>
        <a href="#/checklist" class="shortcut"><span class="ico">✅</span><b>육아 체크리스트</b><span>오늘 ${clToday}/${(cl.items || D.defaultChecklist).length}</span></a>
      </div>
      <div class="section-title"><h2>오늘의 마음 쉼표</h2><a href="#/care">더 보기 ›</a></div>
      <div class="card care-card"><span class="ico">${care.icon}</span><div><span class="chip yellow">${care.cat}</span><h3 style="margin-top:6px">${esc(care.title)}</h3><p class="muted" style="font-size:14px">${esc(care.body)}</p></div></div>
      <div class="section-title"><h2>부모 커뮤니티</h2><a href="#/community">전체 ›</a></div>
      ${[...db.posts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 2).map(postCard).join('')}
    </div>`;
  }
  function vHomeExpert(u) {
    const waiting = db.questions.filter((q) => !q.answer);
    const shared = sharedEmotions().slice(0, 3);
    return `${brandTop()}
    <div class="page">
      <div class="hello"><h2>${esc(u.nickname)} 선생님, 안녕하세요</h2><p>${esc(u.title || '전문가')} · 부모님들이 기다리고 있어요</p></div>
      <div class="grid3">
        <div class="stat"><b>${waiting.length}</b><span>답변 대기</span></div>
        <div class="stat"><b>${db.questions.filter((q) => q.answer?.expertId === u.id).length}</b><span>내 답변</span></div>
        <div class="stat"><b>${sharedEmotions().length}</b><span>공유된 감정</span></div>
      </div>
      <div class="section-title"><h2>답변을 기다리는 질문</h2><a href="#/expert">전체 ›</a></div>
      ${waiting.length ? waiting.map(questionCard).join('') : empty('모든 질문에 답변했어요 🌸', 'assets/images/flower_mascot.png')}
      <div class="section-title"><h2>최근 공유된 감정 기록</h2><a href="#/record">전체 ›</a></div>
      ${shared.length ? shared.map(sharedCard).join('') : empty('공유된 기록이 없어요')}
    </div>`;
  }

  /* ---------------- views: learning ---------------- */
  function vLearn() {
    const L = bucket('lessons');
    const done = L.done || {};
    const cnt = Object.values(done).filter(Boolean).length;
    const assess = bucket('assess');
    const aDone = Object.keys(D.assessments).filter((k) => assess[k]).length;
    const qz = bucket('quiz');
    const next = D.sessions.find((s) => !done[s.n]);
    return `${top('학습')}
    <div class="page">
      <div class="card">
        <div class="row between"><h3>마주봄 6차시 과정</h3><span class="chip">${cnt}/6 완료</span></div>
        <div class="progress purple" style="margin-top:10px"><i style="width:${(cnt / 6) * 100}%"></i></div>
        <p class="muted" style="margin-top:8px">대면 4회 · 플립러닝 1회 · 비대면 1회</p>
      </div>
      <a href="#/assess" class="card soft row"><span class="ico" style="font-size:26px">📋</span><div class="grow"><h3>사전 검사</h3><p class="muted">감정 상태 · 장애 수용 단계 · 애착 유형</p></div><span class="chip ${aDone === 3 ? 'green' : 'yellow'}">${aDone}/3</span></a>
      <div class="section-title"><h2>차시별 학습</h2></div>
      <div class="col">
        ${D.sessions.map((s) => `<a href="#/lesson/${s.n}" class="session ${done[s.n] ? 'done' : ''} ${next?.n === s.n ? 'focus' : ''}">
          <span class="n">${done[s.n] ? '✓' : s.n}</span>
          <div class="grow"><div class="row" style="gap:6px"><span class="chip ${s.type === '대면' ? 'gray' : s.type === '플립러닝' ? '' : 'yellow'}">${s.type}</span>${s.lecture ? '<span class="chip">🎬 강의</span>' : ''}${s.quiz ? `<span class="chip ${qz[s.n] ? 'green' : ''}">✏️ 퀴즈${qz[s.n] ? ` ${qz[s.n].score}/${qz[s.n].total}` : ''}</span>` : ''}</div>
          <b style="display:block;margin-top:6px">${s.n}차시. ${esc(s.title)}</b><span class="muted">${esc(s.sub)}</span></div><span class="arrow">›</span></a>`).join('')}
      </div>
      <div class="section-title"><h2>더 배우기</h2></div>
      <div class="grid2">
        <a href="#/shorts" class="shortcut"><span class="ico">📱</span><b>숏폼 콘텐츠</b><span>카드뉴스 복습 · 유형별 이해</span></a>
        <a href="#/care" class="shortcut"><span class="ico" style="background:var(--yellow100)">☕</span><b>정서 지원</b><span>취미 · 돌봄 · 스트레칭</span></a>
      </div>
    </div>`;
  }

  function vLesson({ n }) {
    const s = D.sessions.find((x) => x.n === +n);
    if (!s) return go('learn'), '';
    const L = bucket('lessons'); L.watched ||= {}; L.done ||= {};
    const qz = bucket('quiz')[s.n];
    const v = s.video;
    return `${top(`${s.n}차시`, 'learn')}
    <div class="page">
      <div><span class="chip">${s.type}</span><h2 style="margin:8px 0 2px;font-size:22px">${esc(s.title)}</h2><p class="muted" style="font-size:14px">${esc(s.sub)}</p></div>
      ${s.lecture ? `
        <div class="section-title"><h2>🎬 온라인 강의</h2><span class="muted">${v.minutes}분</span></div>
        ${v.desc ? `<p class="muted" style="margin-top:-8px">${esc(v.desc)}</p>` : ''}
        ${v.youtubeId
          ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.youtubeId)}" title="${esc(s.title)}" allowfullscreen></iframe></div>`
          : `<div class="video"><img src="${v.thumb}" alt=""><div class="play"><span>▶</span></div></div><p class="muted small">강의 영상이 등록되면 이 자리에서 바로 재생돼요.</p>`}
        <button class="btn ${L.watched[s.n] ? 'ghost' : ''} block" data-act="watched" data-n="${s.n}">${L.watched[s.n] ? '✓ 강의 시청 완료' : '강의 시청 완료로 표시'}</button>` : ''}
      ${s.quiz ? `<a href="#/quiz/${s.n}" class="card soft row"><span style="font-size:26px">✏️</span><div class="grow"><h3>${s.n}차시 퀴즈</h3><p class="muted">${D.quizzes[s.n].length}문항 · O/X · 객관식 · 단답형</p></div>${qz ? `<span class="chip green">${qz.score}/${qz.total}점</span>` : '<span class="chip yellow">미응시</span>'}</a>` : ''}
      ${s.practice ? `<a href="#/checklist" class="card green row"><span style="font-size:26px">🏡</span><div class="grow"><h3>7일 가정 실천하기</h3><p class="muted">활동놀이키트로 실천하고 최소 3회 기록을 남겨요</p></div><span class="arrow">›</span></a>` : ''}
      <div class="section-title"><h2>📌 복습 포인트</h2></div>
      <div class="card col">${s.review.map((r, i) => `<div class="row" style="align-items:flex-start"><span class="chip">${i + 1}</span><p style="font-size:15px">${esc(r)}</p></div>`).join('')}</div>
      <button class="btn block ${L.done[s.n] ? 'line' : ''}" data-act="lessonDone" data-n="${s.n}">${L.done[s.n] ? '✓ 완료한 차시예요 (취소)' : '이 차시 학습 완료'}</button>
    </div>`;
  }

  function vQuiz({ n }) {
    const qs = D.quizzes[n];
    if (!qs) return go('learn'), '';
    const s = st(); s.i ??= 0; s.ans ||= []; s.score ??= 0;
    if (s.i >= qs.length) {
      const prev = bucket('quiz')[n];
      const perfect = s.score === qs.length;
      return `${top(`${n}차시 퀴즈`, `lesson/${n}`)}
      <div class="page"><div class="card result-hero">
        <img src="${perfect ? 'assets/images/flower_mascot.png' : 'assets/images/home_mascot.png'}" alt="">
        <div class="big">${s.score} / ${qs.length}</div>
        <p>${perfect ? '완벽해요! 배운 내용을 잘 기억하고 있어요.' : '잘했어요! 틀린 문항은 복습 포인트를 다시 확인해 보세요.'}</p>
        ${prev ? `<p class="muted small">최근 기록 ${prev.score}/${prev.total} · ${fmtDay(prev.date)}</p>` : ''}
      </div>
      <button class="btn block" data-act="quizRetry">다시 풀기</button>
      <a class="btn ghost block" href="#/lesson/${n}">차시로 돌아가기</a></div>`;
    }
    const q = qs[s.i];
    const a = s.ans[s.i];
    const checked = s.checked;
    const correct = checked && isCorrect(q, a);
    let body = '';
    if (q.type === 'ox') {
      body = `<div class="ox">${['O', 'X'].map((v) => `<button class="${v.toLowerCase()} ${a === v ? 'on' : ''} ${checked && q.a === v ? 'correct' : ''} ${checked && a === v && q.a !== v ? 'wrong' : ''}" data-act="qAns" data-v="${v}" ${checked ? 'disabled' : ''}>${v === 'O' ? '○' : '✕'}</button>`).join('')}</div>`;
    } else if (q.type === 'mc') {
      body = `<div class="col">${q.options.map((o, i) => `<button class="opt ${a === i ? 'on' : ''} ${checked && q.a === i ? 'correct' : ''} ${checked && a === i && q.a !== i ? 'wrong' : ''}" data-act="qAns" data-v="${i}" ${checked ? 'disabled' : ''}><span class="k">${i + 1}</span>${esc(o)}</button>`).join('')}</div>`;
    } else {
      body = `<input class="input" id="shortAns" placeholder="정답을 입력하세요" value="${esc(a || '')}" ${checked ? 'disabled' : ''} autocomplete="off">`;
      if (!checked) after.push(() => document.getElementById('shortAns')?.focus());
    }
    return `${top(`${n}차시 퀴즈`, `lesson/${n}`, `<span class="muted">${s.i + 1}/${qs.length}</span>`)}
    <div class="page">
      <div class="progress purple"><i style="width:${(s.i / qs.length) * 100}%"></i></div>
      <div class="card q-card">
        <span class="q-num">Q${s.i + 1} · ${{ ox: 'O/X', mc: '객관식', short: '단답형' }[q.type]}</span>
        <p class="q-text">${esc(q.q)}</p>
        ${body}
        ${checked ? `<div class="feedback ${correct ? 'ok' : 'no'}"><b>${correct ? '정답이에요! 🎉' : `아쉬워요. 정답: ${q.type === 'mc' ? q.options[q.a] : q.type === 'ox' ? q.a : q.a[0]}`}</b><br>${esc(q.exp)}</div>` : ''}
      </div>
      ${checked ? `<button class="btn block" data-act="qNext">${s.i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button>`
        : `<button class="btn block" data-act="qCheck">정답 확인</button>`}
    </div>`;
  }
  const norm = (x) => String(x ?? '').replace(/\s/g, '').toLowerCase();
  const isCorrect = (q, a) => (q.type === 'short' ? q.a.some((x) => norm(x) === norm(a)) : q.a === a);

  function vAssessList() {
    const A = bucket('assess');
    return `${top('사전 검사', 'learn')}
    <div class="page">
      <div class="notice"><span>💡</span><span>프로그램 참여 전 나의 상태를 살펴보는 간이 자가 점검이에요. 의학적 진단이 아니며, 결과는 프로그램 운영과 사후관리에 참고 자료로만 쓰여요.</span></div>
      ${Object.entries(D.assessments).map(([k, a]) => `<a href="#/assess/${k}" class="card row">
        <span class="ico" style="font-size:28px;width:52px;height:52px;border-radius:18px;background:var(--p100);display:grid;place-items:center">${a.icon}</span>
        <div class="grow"><h3>${a.title}</h3><p class="muted">${a.items.length}문항 · 약 ${a.minutes}분</p></div>
        ${A[k] ? `<span class="chip green">${esc(A[k].label)}</span>` : '<span class="chip yellow">시작하기</span>'}</a>`).join('')}
    </div>`;
  }

  function vAssess({ k }) {
    const a = D.assessments[k];
    if (!a) return go('assess'), '';
    const A = bucket('assess');
    const s = st(); s.ans ||= {};
    if (A[k] && !s.retake) {
      const r = A[k];
      return `${top(a.title, 'assess')}
      <div class="page"><div class="card result-hero">
        <img src="${k === 'acceptance' ? 'assets/images/disability_result_mascot.png' : k === 'attachment' ? 'assets/images/flower_mascot.png' : 'assets/images/home_mascot.png'}" alt="">
        <span class="muted">나의 결과</span><div class="big">${esc(r.label)}</div>
        ${r.score != null ? `<div class="progress purple" style="width:80%"><i style="width:${r.score}%"></i></div><span class="muted small">마음 건강 지수 ${r.score}점</span>` : ''}
        <p style="margin-top:6px">${esc(r.msg)}</p>
        <p class="muted small">${fmtDay(r.date)} 검사</p>
      </div>
      <button class="btn ghost block" data-act="retake">다시 검사하기</button>
      <a href="#/assess" class="btn line block">다른 검사 보기</a></div>`;
    }
    const answered = Object.keys(s.ans).length;
    return `${top(a.title, 'assess', `<span class="muted">${answered}/${a.items.length}</span>`)}
    <div class="page">
      <p class="muted" style="font-size:14px">${a.intro}</p>
      ${a.items.map((it, i) => `<div class="card q-card" style="gap:12px">
        <span class="q-num">${i + 1}</span><p style="font-weight:800;margin:0">${esc(it.q)}</p>
        <div class="scale">${a.scale.map((l, v) => `<button data-act="scale" data-i="${i}" data-v="${v + 1}" class="${s.ans[i] === v + 1 ? 'on' : ''}"><i></i>${l}</button>`).join('')}</div>
      </div>`).join('')}
      <button class="btn block" data-act="assessSubmit" data-k="${k}" ${answered < a.items.length ? 'disabled' : ''}>결과 보기</button>
    </div>`;
  }
  function scoreAssess(k, ans) {
    const a = D.assessments[k];
    if (k === 'emotion') {
      const vals = a.items.map((it, i) => (it.rev ? 6 - ans[i] : ans[i]));
      const avg = vals.reduce((x, y) => x + y, 0) / vals.length;
      const score = Math.round(((avg - 1) / 4) * 100);
      const [label, msg] = score >= 70 ? ['안정적이에요', '지금의 균형을 잘 지켜가고 있어요. 이 힘을 아이와의 시간에도 나눠 주세요.']
        : score >= 45 ? ['조금 지쳐 있어요', '애쓰고 계신 만큼 쉼도 필요해요. 정서 지원 콘텐츠로 하루 5분 나를 돌봐 주세요.']
          : ['많이 지쳐 있어요', '혼자 감당하기엔 무거운 시기예요. 전문가 게시판에 마음을 털어놓아도 괜찮아요.'];
      return { label, msg, score };
    }
    if (k === 'attachment') {
      let A = 0, B = 0;
      a.items.forEach((it, i) => { if (ans[i] >= 4) it.group === 'A' ? A++ : B++; });
      const key = A >= 3 && B >= 3 ? 'mixed' : A >= 3 ? 'anxious' : B >= 3 ? 'avoidant' : 'secure';
      return { label: a.types[key].name, msg: a.types[key].msg, key, detail: `A ${A}개 · B ${B}개` };
    }
    const keyName = k === 'acceptance' ? 'stage' : 'type';
    const dict = k === 'acceptance' ? a.stages : a.types;
    const sums = {}, cnts = {};
    a.items.forEach((it, i) => { sums[it[keyName]] = (sums[it[keyName]] || 0) + ans[i]; cnts[it[keyName]] = (cnts[it[keyName]] || 0) + 1; });
    const best = Object.keys(sums).sort((x, y) => sums[y] / cnts[y] - sums[x] / cnts[x])[0];
    return { label: dict[best].name, msg: dict[best].msg, key: best };
  }

  function vShorts() {
    const s = st(); s.t ??= 0;
    const t = D.shorts.types[s.t];
    return `${top('숏폼 콘텐츠', 'learn')}
    <div class="page">
      <div class="section-title"><h2>📇 카드뉴스로 복습해요</h2><span class="muted">옆으로 넘겨보세요</span></div>
      <div class="snap">${D.sessions.map((x, i) => `<div class="cardnews cn${i % 4}">
        <span class="t">${x.n}차시 · ${esc(x.title)}</span>
        <div class="m">${esc(x.review[0])}</div>
        <div class="f">${x.review.slice(1).map(esc).join('<br>')}</div></div>`).join('')}</div>
      <div class="section-title"><h2>🧠 발달 특성 이해하기</h2></div>
      <div class="pills">${D.shorts.types.map((x, i) => `<button data-act="shortType" data-i="${i}" class="${s.t === i ? 'on' : ''}">${x.icon} ${x.name}</button>`).join('')}</div>
      <div class="card col">
        <h3>${t.icon} ${t.name}</h3>
        <b class="small" style="color:var(--p700)">이런 모습을 보일 수 있어요</b>
        ${t.traits.map((x) => `<p style="font-size:14px">• ${esc(x)}</p>`).join('')}
        <hr class="sep"><b class="small" style="color:#3F7A22">이렇게 도와주세요</b>
        ${t.tips.map((x) => `<p style="font-size:14px">✓ ${esc(x)}</p>`).join('')}
        <p class="muted small">아이마다 특성은 모두 달라요. 일반적인 참고 정보예요.</p>
      </div>
      <div class="section-title"><h2>▶ 유튜브로 더 알아보기</h2></div>
      <p class="tap-hint">👇 눌러서 영상을 직접 보세요</p>
      <div class="yt-list">${D.shorts.links.map((l) => `<a class="yt" href="https://www.youtube.com/results?search_query=${encodeURIComponent(l.q)}" target="_blank" rel="noopener">
        <span class="thumb" aria-hidden="true"></span>
        <div class="grow"><b style="font-size:15px">${esc(l.title)}</b><br><span class="go">▶ 유튜브에서 보기</span></div></a>`).join('')}</div>
    </div>`;
  }

  function vCare() {
    const s = st(); s.c ||= '전체';
    const P = bucket('prefs');
    const list = D.care.filter((c) => s.c === '전체' || c.cat === s.c);
    return `${top('정서 지원 콘텐츠', 'learn')}
    <div class="page">
      <div class="card yellow row"><span style="font-size:44px;line-height:1">☕</span><div><h3>잠깐, 나를 위한 쉼표</h3><p class="muted">학습 부담 없이 짧고 가볍게 즐겨요.</p></div></div>
      <div class="card row between">
        <div><b>마음 쉼표 알림</b><p class="muted">하루 한 번, 앱을 열 때 오늘의 쉼표를 알려드려요</p></div>
        <button class="switch ${P.push ? 'on' : ''}" data-act="togglePush" aria-label="알림 켜기"></button>
      </div>
      <div class="seg">${['전체', '취미', '돌봄', '스트레칭'].map((c) => `<button data-act="careCat" data-v="${c}" class="${s.c === c ? 'on' : ''}">${c}</button>`).join('')}</div>
      ${list.map((c) => `<div class="card care-card"><span class="ico">${c.icon}</span><div><span class="chip yellow">${c.cat}</span><h3 style="margin-top:6px">${esc(c.title)}</h3><p class="muted" style="font-size:14px">${esc(c.body)}</p></div></div>`).join('')}
    </div>`;
  }

  /* ---------------- views: community ---------------- */
  const commTabs = (on) => `<div class="seg"><a href="#/community" class="${on === 'c' ? 'on' : ''}">부모 커뮤니티</a><a href="#/expert" class="${on === 'e' ? 'on' : ''}">전문가 게시판</a></div>`;
  const CATS = ['전체', '일상 나눔', '질문', '응원', '정보'];
  function postCard(p) {
    const u = user(p.authorId);
    return `<a href="#/post/${p.id}" class="post">
      ${authorLine(u, p.createdAt)}
      <div class="row" style="gap:6px"><span class="chip gray">${esc(p.cat)}</span><h3 class="grow">${esc(p.title)}</h3></div>
      <p class="body">${esc(p.body)}</p>
      <div class="meta"><span>💜 ${p.likes.length}</span><span>💬 ${p.comments.length}</span></div></a>`;
  }
  function vCommunity() {
    const s = st(); s.cat ||= '전체';
    if (!db.rulesSeen[db.session]) after.push(showRules);
    const list = db.posts.filter((p) => s.cat === '전체' || p.cat === s.cat).sort((a, b) => b.createdAt - a.createdAt);
    return `${top('커뮤니티')}
    <div class="page">
      ${commTabs('c')}
      ${pin('community')}
      ${!isExpert() ? (() => { const g = gradeOf(db.session); return `<div class="notice"><span>🌱</span><span>댓글로 마음을 나누면 등급이 올라가요. 지금 <b>${g.name}</b> · 댓글 ${g.count}개${g.next ? ` · ${g.next.name}까지 ${g.next.min - g.count}개` : ''}</span></div>`; })() : ''}
      <div class="pills">${CATS.map((c) => `<button data-act="cat" data-v="${c}" class="${s.cat === c ? 'on' : ''}">${c}</button>`).join('')}</div>
      ${list.length ? list.map(postCard).join('') : empty('아직 글이 없어요. 첫 이야기를 들려주세요.')}
    </div>
    <a href="#/write" class="fab" aria-label="글쓰기">✎</a>`;
  }
  const pin = (k) => `<a href="#/rules/${k}" class="pin"><span class="pin-ico">❗</span><span class="grow"><b class="pin-tag">[필독]</b> ${esc(D.rulesFull[k].title)}</span><span class="chip rose">공지</span></a>`;
  function vRules({ k = 'community' }) {
    const r = D.rulesFull[k] || D.rulesFull.community;
    return `${top('이용규칙', !me() ? 'signup' : k === 'expert' ? 'expert' : 'community')}
    <div class="page">
      <div class="card col" style="gap:6px"><span class="chip rose" style="align-self:flex-start">❗ 필독 공지</span><h2 style="margin:4px 0 0;font-size:20px">${esc(r.title)}</h2><p class="muted" style="font-size:14px">${esc(r.intro)}</p></div>
      ${r.sections.map((sec) => `<div class="card col" style="gap:8px"><h3>${esc(sec.h)}</h3>${sec.items.map((x) => `<p style="font-size:14px">• ${esc(x)}</p>`).join('')}</div>`).join('')}
      ${k === 'community' && me() && !isExpert() && !db.rulesSeen[db.session] ? '<button class="btn block" data-act="rulesOk">모두 읽었어요</button>' : ''}
      <a href="#/rules/${k === 'expert' ? 'community' : 'expert'}" class="btn line block">${k === 'expert' ? '부모 커뮤니티 이용규칙 보기' : '전문가 게시판 이용 안내 보기'}</a>
    </div>`;
  }
  function showRules() {
    modal(`<h3>📜 마주봄 커뮤니티 약속</h3>
      <p class="muted">모두가 안전하게 마음을 나눌 수 있도록 함께 지켜 주세요.</p>
      <div class="col">${D.communityRules.map((r, i) => `<div class="row" style="align-items:flex-start"><span class="chip">${i + 1}</span><span style="font-size:14px">${esc(r)}</span></div>`).join('')}</div>
      <button class="btn block" data-act="rulesOk">확인했어요</button>
      <a class="btn line block" href="#/rules/community">이용규칙 전체 보기</a>`);
  }
  function vPost({ id }) {
    const p = db.posts.find((x) => x.id === id);
    if (!p) return go('community'), '';
    const u = user(p.authorId);
    const liked = p.likes.includes(db.session);
    const mine = p.authorId === db.session;
    return `${top('', 'community', mine ? `<button class="icon-btn" data-act="delPost" data-id="${p.id}" aria-label="삭제">🗑</button>` : '')}
    <div class="page">
      <div class="post post-full" style="box-shadow:none;background:transparent;padding:0">
        ${authorLine(u, p.createdAt)}
        <span class="chip gray" style="align-self:flex-start">${esc(p.cat)}</span>
        <h3 style="font-size:20px">${esc(p.title)}</h3>
        <p class="body">${esc(p.body)}</p>
        <div class="row"><button class="btn sm ${liked ? '' : 'line'}" data-act="like" data-id="${p.id}">💜 공감 ${p.likes.length}</button><span class="muted">💬 댓글 ${p.comments.length}</span></div>
      </div>
      <div>
        ${p.comments.map((c) => { const cu = user(c.authorId); return `<div class="comment">${avatar(cu)}<div class="grow"><div class="row" style="gap:6px"><b class="small">${esc(cu.nickname)}</b>${cu.role === 'expert' ? '<span class="chip green">전문가</span>' : ''}<span class="muted small">${ago(c.createdAt)}</span>${c.authorId === db.session ? `<button class="muted small" data-act="delComment" data-p="${p.id}" data-id="${c.id}">삭제</button>` : ''}</div><p class="txt">${esc(c.body)}</p></div></div>`; }).join('') || '<p class="muted" style="padding:10px 0">첫 댓글로 따뜻한 마음을 전해 주세요.</p>'}
      </div>
      <form class="comment-form" data-form="comment" data-id="${p.id}">
        <input class="input grow" name="body" placeholder="공감의 한마디를 남겨 주세요" required maxlength="500" autocomplete="off">
        <button class="btn" type="submit" style="height:auto">등록</button>
      </form>
    </div>`;
  }
  function vWrite() {
    const s = st(); s.cat ||= '일상 나눔';
    return `${top('글쓰기', 'community')}
    <form class="page" data-form="post">
      <div class="pills">${CATS.slice(1).map((c) => `<button type="button" data-act="cat" data-v="${c}" class="${s.cat === c ? 'on' : ''}">${c}</button>`).join('')}</div>
      <input class="input" name="title" placeholder="제목" required maxlength="60">
      <textarea class="input" name="body" placeholder="오늘 있었던 일, 고민, 응원하고 싶은 마음을 나눠 주세요." required style="min-height:200px"></textarea>
      <div class="notice"><span>🤝</span><span>아이들을 서로 비교하지 않기, 개인정보(실명·기관명·사진) 올리지 않기를 지켜 주세요.</span></div>
      <button class="btn block" type="submit">올리기</button>
    </form>`;
  }

  function questionCard(q) {
    const u = user(q.authorId);
    return `<a href="#/expert/${q.id}" class="post">
      <div class="row" style="gap:6px"><span class="chip">${esc(q.field)}</span><span class="chip gray">${esc(q.childAge || '연령 미입력')}</span>${q.public ? '' : '<span class="chip gray">🔒 비공개</span>'}<span class="grow"></span>${q.answer ? '<span class="chip green">답변 완료</span>' : '<span class="chip yellow">답변 대기</span>'}</div>
      <h3>${esc(q.question)}</h3><p class="body">${esc(q.situation)}</p>
      <div class="meta"><span>${esc(u.nickname)}</span><span>${ago(q.createdAt)}</span></div></a>`;
  }
  function vExpert() {
    const s = st(); s.f ||= isExpert() ? 'wait' : 'all';
    const u = me();
    let list = db.questions.filter((q) => q.public || q.authorId === u.id || isExpert());
    if (s.f === 'mine') list = list.filter((q) => q.authorId === u.id);
    if (s.f === 'wait') list = list.filter((q) => !q.answer);
    if (s.f === 'done') list = list.filter((q) => q.answer);
    list.sort((a, b) => b.createdAt - a.createdAt);
    const left = dailyLimit(u.id) - questionsToday(u.id);
    const filters = isExpert() ? [['wait', '답변 대기'], ['done', '답변 완료'], ['all', '전체']] : [['all', '전체 질문'], ['mine', '내 질문']];
    return `${top('커뮤니티')}
    <div class="page">
      ${commTabs('e')}
      ${pin('expert')}
      ${isExpert() ? '' : `<div class="card soft row"><span style="font-size:28px">🩺</span><div class="grow"><b>전문가에게 직접 물어보세요</b><p class="muted">하루 ${dailyLimit(u.id)}회 · 오늘 ${Math.max(0, left)}회 남았어요</p></div><a href="#/expert/new" class="btn sm ${left > 0 ? '' : 'ghost'}" ${left > 0 ? '' : 'aria-disabled="true" data-act="limit"'}>질문하기</a></div>`}
      <div class="pills">${filters.map(([k, l]) => `<button data-act="qFilter" data-v="${k}" class="${s.f === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${list.length ? list.map(questionCard).join('') : empty(s.f === 'mine' ? '아직 남긴 질문이 없어요.' : '질문이 없어요.')}
    </div>`;
  }
  function vExpertNew() {
    const u = me();
    if (isExpert()) return go('expert'), '';
    const left = dailyLimit(u.id) - questionsToday(u.id);
    const s = st(); s.field ||= D.expertFields[0];
    if (left <= 0) {
      return `${top('질문하기', 'expert')}<div class="page">${empty('오늘 질문 횟수를 모두 사용했어요.<br>내일 다시 남겨 주세요. 급한 고민은 커뮤니티에서 나눠 보세요.')}</div>`;
    }
    return `${top('전문가에게 질문하기', 'expert')}
    <form class="page" data-form="question">
      <div class="field"><label>질문 분야</label><div class="pills">${D.expertFields.map((f) => `<button type="button" data-act="qField" data-v="${f}" class="${s.field === f ? 'on' : ''}">${f}</button>`).join('')}</div></div>
      <div class="field"><label>자녀 연령</label><input class="input" name="childAge" value="${esc(u.childAge || '')}" placeholder="예: 5세" required></div>
      <div class="field"><label>구체적인 상황</label><textarea class="input" name="situation" required placeholder="언제, 어디서, 아이가 어떤 행동을 하는지 적어 주세요."></textarea></div>
      <div class="field"><label>궁금한 점</label><textarea class="input" name="question" required style="min-height:90px" placeholder="전문가에게 묻고 싶은 내용을 적어 주세요."></textarea></div>
      <label class="row"><input type="checkbox" name="public" checked> <span style="font-size:14px">다른 부모님께도 공개 (닉네임만 표시)</span></label>
      <div class="notice"><span>⏳</span><span>하루 ${dailyLimit(u.id)}회 질문할 수 있어요 (오늘 ${left}회 남음). 응급 상황은 가까운 의료기관에 문의해 주세요.</span></div>
      <button class="btn block" type="submit">질문 보내기</button>
    </form>`;
  }
  function vExpertQ({ id }) {
    const q = db.questions.find((x) => x.id === id);
    if (!q || (!q.public && q.authorId !== db.session && !isExpert())) return go('expert'), '';
    const u = user(q.authorId);
    const ex = q.answer && user(q.answer.expertId);
    return `${top('전문가 게시판', 'expert', q.authorId === db.session && !q.answer ? `<button class="icon-btn" data-act="delQ" data-id="${q.id}" aria-label="삭제">🗑</button>` : '')}
    <div class="page">
      <div class="row" style="gap:6px"><span class="chip">${esc(q.field)}</span><span class="chip gray">자녀 ${esc(q.childAge)}</span></div>
      ${authorLine(u, q.createdAt)}
      <div class="card col"><b class="small" style="color:var(--p700)">상황</b><p style="white-space:pre-wrap">${esc(q.situation)}</p><hr class="sep"><b class="small" style="color:var(--p700)">궁금한 점</b><p style="white-space:pre-wrap;font-weight:700">${esc(q.question)}</p></div>
      ${q.answer ? `<div class="answer"><div class="who">🩺 ${esc(ex.nickname)} ${esc(ex.title || '전문가')} · ${ago(q.answer.createdAt)}</div><p style="white-space:pre-wrap;font-size:15px">${esc(q.answer.body)}</p></div>`
        : isExpert() ? `<form class="col" data-form="answer" data-id="${q.id}"><textarea class="input" name="body" required placeholder="부모님께 따뜻하고 구체적인 답변을 남겨 주세요." style="min-height:180px"></textarea><button class="btn block" type="submit">답변 등록</button></form>`
          : `<div class="card yellow row"><span style="font-size:24px">⏳</span><p>전문가가 확인 후 답변을 드릴 예정이에요.</p></div>`}
    </div>`;
  }

  /* ---------------- views: records ---------------- */
  function calendar(month, emo, pickable) {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const t = dkey();
    let cells = '일월화수목금토'.split('').map((d) => `<span class="dow">${d}</span>`).join('');
    for (let i = 0; i < first; i++) cells += '<span class="d empty"></span>';
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${pad(m + 1)}-${pad(d)}`;
      const e = emo[k];
      const future = k > t;
      cells += `<span class="d ${k === t ? 'today' : ''} ${pickable && !future ? 'pick' : ''}" ${e ? `style="background:${moodOf(e.mood).color}40"` : ''} ${pickable && !future ? `data-act="pickDate" data-k="${k}"` : ''}>${e ? `<img src="${moodOf(e.mood).img}" alt="${moodOf(e.mood).label}">` : d}</span>`;
    }
    return `<div class="cal">${cells}</div>`;
  }
  function sharedEmotions() {
    const out = [];
    for (const [uidk, days] of Object.entries(db.emotions || {})) {
      for (const [k, e] of Object.entries(days)) if (e.shared) out.push({ uid: uidk, k, ...e });
    }
    return out.sort((a, b) => (a.k < b.k ? 1 : -1));
  }
  const sharedCard = (e) => `<div class="card row" style="align-items:flex-start"><img src="${moodOf(e.mood).img}" alt="" style="width:52px;mix-blend-mode:multiply"><div class="grow"><div class="row" style="gap:6px"><b>${esc(user(e.uid).nickname)}</b><span class="muted small">${fmtDay(e.k)}</span></div><p style="font-size:14px;white-space:pre-wrap">${esc(e.memo || '(메모 없음)')}</p></div></div>`;

  function vRecord() {
    if (isExpert()) {
      const list = sharedEmotions();
      return `${top('공유된 감정 기록')}<div class="page"><div class="notice"><span>🔒</span><span>부모님이 “전문가와 공유”를 선택한 기록만 보여요. 필요한 경우 전문가 게시판이나 상담으로 피드백해 주세요.</span></div>${list.length ? list.map(sharedCard).join('') : empty('공유된 기록이 없어요')}</div>`;
    }
    const s = st(); s.m ||= dkey().slice(0, 7);
    const month = fromKey(s.m + '-01');
    const emo = bucket('emotions');
    const cl = bucket('checklist');
    const items = cl.items || D.defaultChecklist;
    const todayCl = (cl.log?.[dkey()] || []).filter(Boolean).length;
    const te = emo[dkey()];
    return `${top('기록')}
    <div class="page">
      <div class="notice"><span>🌿</span><span>기록은 의무가 아니에요. 필요하다고 느낄 때만 편하게 남겨 주세요.</span></div>
      <div class="grid2">
        <a href="#/emotion" class="shortcut"><span class="ico">${te ? `<img src="${moodOf(te.mood).img}" alt="" style="width:36px;mix-blend-mode:multiply">` : '😊'}</span><b>감정 기록</b><span>${te ? `오늘: ${moodOf(te.mood).label}` : '오늘 아직 기록 전'}</span></a>
        <a href="#/checklist" class="shortcut"><span class="ico" style="background:var(--green100)">✅</span><b>육아 체크리스트</b><span>오늘 ${todayCl}/${items.length} 실천</span></a>
      </div>
      <div class="card col">
        <div class="row between"><button class="icon-btn" data-act="month" data-d="-1" aria-label="이전 달">‹</button><b>${month.getFullYear()}년 ${month.getMonth() + 1}월 마음 달력</b><button class="icon-btn" data-act="month" data-d="1" aria-label="다음 달">›</button></div>
        ${calendar(month, emo, true)}
        <div class="row" style="justify-content:center;gap:14px">${D.moods.map((m) => `<span class="muted small row" style="gap:4px"><img src="${m.img}" alt="" style="width:20px;mix-blend-mode:multiply">${m.label}</span>`).join('')}</div>
      </div>
      <a href="#/report" class="card tint row"><span style="font-size:28px">📊</span><div class="grow"><h3>4주 실천 리포트</h3><p style="opacity:.85;font-size:13px">추적평가에 활용되는 나의 변화 기록</p></div><span>›</span></a>
    </div>`;
  }

  function vEmotion() {
    const s = st();
    if (pendingDate) { s.k = pendingDate; s.mood = undefined; pendingDate = null; }
    s.k ||= dkey();
    const emo = bucket('emotions');
    const e = emo[s.k] || {};
    if (s.mood === undefined) { s.mood = e.mood || null; s.memo = e.memo || ''; s.shared = !!e.shared; }
    const recent = Object.entries(emo).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
    after.push(() => {
      const ta = document.getElementById('memo');
      if (ta) ta.addEventListener('input', () => { st().memo = ta.value; });
    });
    return `${top('감정 기록', 'record')}
    <div class="page">
      <div class="row between"><h2 style="margin:0;font-size:19px">${fmtDay(s.k)}</h2>${s.k !== dkey() ? '<button class="btn sm ghost" data-act="pickDate" data-k="' + dkey() + '">오늘로</button>' : ''}</div>
      <p class="muted" style="margin-top:-8px">오늘 나의 마음과 가장 가까운 얼굴을 골라 주세요.</p>
      <div class="mood-quick">${D.moods.map((m) => `<button class="mood-btn ${s.mood === m.key ? 'on' : ''}" data-act="pickMood" data-m="${m.key}"><img src="${m.img}" alt="">${m.label}</button>`).join('')}</div>
      <div class="field"><label>마음 메모 (선택)</label>
        <div class="row" style="align-items:flex-start"><textarea class="input grow" id="memo" placeholder="오늘 있었던 일, 떠오른 생각을 자유롭게 적어 보세요." maxlength="1000">${esc(s.memo)}</textarea>
        <button class="mic ${s.rec ? 'on' : ''}" data-act="mic" aria-label="음성으로 입력">🎤</button></div>
        <span class="muted small">🎤 버튼을 누르고 말하면 글자로 바꿔 드려요${s.rec ? ' · 듣고 있어요…' : ''}</span>
      </div>
      <div class="card row between"><div><b>전문가와 공유</b><p class="muted">공유하면 전문가가 보고 피드백을 줄 수 있어요</p></div><button class="switch ${s.shared ? 'on' : ''}" data-act="toggleShare" aria-label="전문가와 공유"></button></div>
      <button class="btn block" data-act="saveEmotion" ${s.mood ? '' : 'disabled'}>기록하기</button>
      ${emo[s.k] ? `<button class="btn line block" data-act="delEmotion">이 날 기록 지우기</button>` : ''}
      <div class="section-title"><h2>최근 기록</h2></div>
      ${recent.length ? recent.map(([k, x]) => `<button class="card row" style="text-align:left;width:100%" data-act="pickDate" data-k="${k}"><img src="${moodOf(x.mood).img}" alt="" style="width:46px;mix-blend-mode:multiply"><div class="grow"><b class="small">${fmtDay(k)} · ${moodOf(x.mood).label}</b>${x.shared ? ' <span class="chip green">공유</span>' : ''}<p class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.memo || '메모 없음')}</p></div></button>`).join('') : empty('첫 감정을 기록해 보세요.')}
    </div>`;
  }

  function vChecklist() {
    const cl = bucket('checklist');
    cl.items ||= [...D.defaultChecklist]; cl.log ||= {};
    const s = st();
    const t = dkey();
    const today = cl.log[t] || [];
    const has = (i) => (cl.log[dkey(addDays(new Date(), -i))] || []).some(Boolean);
    let streak = 0;
    for (let i = has(0) ? 0 : 1; has(i) && i < 400; i++) streak++;
    const weeks = [];
    for (let w = 3; w >= 0; w--) {
      const row = [];
      for (let d = 6; d >= 0; d--) { const k = dkey(addDays(new Date(), -(w * 7 + d))); row.push({ k, n: (cl.log[k] || []).filter(Boolean).length }); }
      weeks.push(row);
    }
    if (s.edit) {
      return `${top('체크리스트 항목 편집', 'checklist')}
      <form class="page" data-form="clItems">
        <p class="muted">핵심 실천 항목을 최대 3개까지 정할 수 있어요. 비워두면 항목이 빠져요.</p>
        ${[0, 1, 2].map((i) => `<input class="input" name="i${i}" value="${esc(cl.items[i] || '')}" maxlength="40" placeholder="항목 ${i + 1}">`).join('')}
        <button class="btn block" type="submit">저장</button>
        <button class="btn line block" type="button" data-act="clEdit">취소</button>
      </form>`;
    }
    return `${top('육아 체크리스트', 'record', `<button class="icon-btn" data-act="clEdit" aria-label="항목 편집">✏️</button>`)}
    <div class="page">
      <div class="card green row"><img src="assets/images/home_mascot.png" alt="" style="width:64px;mix-blend-mode:multiply"><div><h3>오늘 ${today.filter(Boolean).length}/${cl.items.length} 실천했어요</h3><p class="muted">${streak ? `${streak}일째 이어가는 중 🌱` : '작은 실천 하나면 충분해요'}</p></div></div>
      <div class="col">${cl.items.map((it, i) => `<button class="check-item ${today[i] ? 'on' : ''}" data-act="check" data-i="${i}"><span class="box">${today[i] ? '✓' : ''}</span>${esc(it)}</button>`).join('')}</div>
      <div class="section-title"><h2>최근 4주</h2><span class="muted small">진할수록 많이 실천</span></div>
      <div class="card col">
        <div class="week">${weeks[3].map((c) => `<div>${'일월화수목금토'[fromKey(c.k).getDay()]}</div>`).join('')}</div>
        ${weeks.map((row) => `<div class="week">${row.map((c) => `<div><i class="l${Math.min(3, c.n)}" title="${fmtDay(c.k)}">${c.k === t ? '오늘' : fromKey(c.k).getDate()}</i></div>`).join('')}</div>`).join('')}
      </div>
      <div class="notice"><span>📊</span><span>체크리스트 기록은 프로그램 종료 4주 후 추적평가 자료로 활용돼요.</span></div>
    </div>`;
  }

  function reportData() {
    const emo = bucket('emotions');
    const cl = bucket('checklist');
    const items = cl.items || D.defaultChecklist;
    const rows = [];
    for (let i = 27; i >= 0; i--) {
      const k = dkey(addDays(new Date(), -i));
      rows.push({ k, e: emo[k], c: cl.log?.[k] || [] });
    }
    return { rows, items };
  }
  function vReport() {
    const { rows, items } = reportData();
    const eRows = rows.filter((r) => r.e);
    const cnt = Object.fromEntries(D.moods.map((m) => [m.key, eRows.filter((r) => r.e.mood === m.key).length]));
    const cDays = rows.filter((r) => r.c.some(Boolean)).length;
    const perItem = items.map((_, i) => rows.filter((r) => r.c[i]).length);
    const half = (arr, f) => { const a = arr.slice(0, 14), b = arr.slice(14); return [a.filter(f).length, b.filter(f).length]; };
    const [g1, g2] = half(rows, (r) => r.e?.mood === 'good');
    const A = bucket('assess'), Q = bucket('quiz');
    return `${top('4주 실천 리포트', 'record')}
    <div class="page">
      <p class="muted">${fmtDay(rows[0].k)} ~ ${fmtDay(rows[27].k)}</p>
      <div class="grid3">
        <div class="stat"><b>${eRows.length}</b><span>감정 기록일</span></div>
        <div class="stat"><b>${cDays}</b><span>실천한 날</span></div>
        <div class="stat"><b>${Math.round((cDays / 28) * 100)}%</b><span>실천율</span></div>
      </div>
      <div class="card col"><h3>마음 분포</h3>
        ${D.moods.map((m) => `<div class="row"><img src="${m.img}" alt="" style="width:30px;mix-blend-mode:multiply"><span style="width:62px;font-size:13px">${m.label}</span><div class="progress grow"><i style="width:${eRows.length ? (cnt[m.key] / eRows.length) * 100 : 0}%;background:${m.color}"></i></div><b class="small" style="width:28px;text-align:right">${cnt[m.key]}</b></div>`).join('')}
        <p class="muted small">‘좋아요’ 기록: 앞 2주 ${g1}일 → 최근 2주 ${g2}일 ${g2 > g1 ? '📈' : ''}</p>
      </div>
      <div class="card col"><h3>항목별 실천</h3>
        ${items.map((it, i) => `<div><div class="row between small"><span>${esc(it)}</span><b>${perItem[i]}/28</b></div><div class="progress" style="margin-top:4px"><i style="width:${(perItem[i] / 28) * 100}%"></i></div></div>`).join('')}
      </div>
      <div class="card col"><h3>학습 현황</h3>
        ${Object.entries(D.assessments).map(([k, a]) => `<div class="row between small"><span>${a.title}</span><b>${A[k] ? esc(A[k].label) : '-'}</b></div>`).join('')}
        ${Object.keys(D.quizzes).map((n) => `<div class="row between small"><span>${n}차시 퀴즈</span><b>${Q[n] ? `${Q[n].score}/${Q[n].total}` : '-'}</b></div>`).join('')}
      </div>
      <button class="btn block" data-act="csv">📥 기록 내려받기 (CSV)</button>
      <p class="muted small" style="text-align:center">추적평가 시 운영진에게 제출할 수 있어요.</p>
    </div>`;
  }

  /* ---------------- views: my ---------------- */
  function vMy() {
    const u = me();
    const g = gradeOf(u.id);
    const P = bucket('prefs');
    const myPosts = db.posts.filter((p) => p.authorId === u.id).length;
    const myQ = db.questions.filter((q) => (isExpert() ? q.answer?.expertId === u.id : q.authorId === u.id)).length;
    return `${top('마이페이지')}
    <div class="page">
      <div class="card row">
        <div class="mascot" style="width:72px;height:72px;border-radius:24px;background:var(--p50);display:grid;place-items:center">${isExpert() ? '<span style="font-size:36px">🩺</span>' : `<img src="${g.img}" alt="" style="width:62px;mix-blend-mode:multiply">`}</div>
        <div class="grow"><h3 style="font-size:19px">${esc(u.nickname)}</h3><p class="muted">${isExpert() ? esc(u.title || '전문가') : `자녀 ${esc(u.childAge || '-')} · @${esc(u.username)}`}</p></div>
        ${isExpert() ? '<span class="chip green">전문가</span>' : `<span class="chip">${g.name}</span>`}
      </div>
      <div class="grid3">
        <div class="stat"><b>${myPosts}</b><span>내 글</span></div>
        <div class="stat"><b>${commentCount(u.id)}</b><span>내 댓글</span></div>
        <div class="stat"><b>${myQ}</b><span>${isExpert() ? '내 답변' : '내 질문'}</span></div>
      </div>
      ${isExpert() ? '' : `
      <div class="section-title"><h2>나의 성장 등급</h2></div>
      <div class="card col">
        ${D.grades.map((x) => { const got = g.count >= x.min; return `<div class="row" style="opacity:${got ? 1 : 0.55}">
          <div style="width:58px;height:58px;border-radius:18px;background:${x.key === g.key ? 'var(--green100)' : 'var(--p50)'};display:grid;place-items:center;flex-shrink:0"><img src="${x.img}" alt="" style="width:48px;mix-blend-mode:multiply;${got ? '' : 'filter:grayscale(1)'}"></div>
          <div class="grow"><div class="row" style="gap:6px"><b>${x.name}</b><span class="muted small">댓글 ${x.min}개+</span>${x.key === g.key ? '<span class="chip green">현재</span>' : ''}</div><p class="muted">🎁 ${esc(x.reward)}</p></div>
          ${got ? '✓' : '🔒'}</div>`; }).join('<hr class="sep">')}
        ${g.key === 'flower' ? (u.senior ? '<div class="notice"><span>🌸</span><span>선배 부모로 활동 중이에요. 다음 기수 부모님들께 힘이 되어 주세요.</span></div>' : '<button class="btn block" data-act="senior">선배 부모 활동 신청하기</button>') : `<p class="muted small">꽃 등급이 되면 다음 기수의 선배 부모로 활동할 수 있어요.</p>`}
      </div>`}
      <div class="section-title"><h2>설정</h2></div>
      <div class="card list">
        <div class="list-item"><span class="ico">🔔</span><div class="grow"><b style="font-size:14px">마음 쉼표 알림</b></div><button class="switch ${P.push ? 'on' : ''}" data-act="togglePush" aria-label="알림"></button></div>
        ${isExpert() ? '' : '<a class="list-item" href="#/assess"><span class="ico">📋</span><b class="grow" style="font-size:14px">사전 검사 결과</b><span class="arrow">›</span></a><a class="list-item" href="#/report"><span class="ico">📊</span><b class="grow" style="font-size:14px">4주 실천 리포트</b><span class="arrow">›</span></a>'}
      </div>
      <div class="section-title"><h2>계정</h2></div>
      <div class="card list">
        <a class="list-item" href="#/profile"><span class="ico">👤</span><b class="grow" style="font-size:14px">내 정보 수정</b><span class="arrow">›</span></a>
        <a class="list-item" href="#/privacy"><span class="ico">🔐</span><div class="grow"><b style="font-size:14px">개인정보 수집·이용 동의</b><p class="muted small">${u.consent?.optional ? '필수 · 선택 동의함' : '필수 동의함'}</p></div><span class="arrow">›</span></a>
        <a class="list-item" href="#/rules/community"><span class="ico">❗</span><b class="grow" style="font-size:14px">커뮤니티 이용규칙</b><span class="arrow">›</span></a>
        <button class="list-item" data-act="logout" style="width:100%;text-align:left"><span class="ico">🚪</span><b class="grow" style="font-size:14px">로그아웃</b><span class="arrow">›</span></button>
      </div>
      <button class="muted small" data-act="withdraw" style="align-self:center">회원 탈퇴</button>
      <button class="muted small" data-act="reset" style="align-self:center">체험 데이터 초기화</button>
    </div>`;
  }

  function vProfile() {
    const u = me();
    return `${top('내 정보 수정', 'my')}
    <form class="page" data-form="profile">
      <div class="field"><label>아이디</label><input class="input" value="${esc(u.username)}" disabled></div>
      <div class="field"><label>닉네임</label><input class="input" name="nickname" value="${esc(u.nickname)}" required maxlength="12"></div>
      ${u.role === 'expert'
        ? `<div class="field"><label>전문 분야</label><input class="input" name="title" value="${esc(u.title || '')}"></div>`
        : `<div class="field"><label>자녀 연령</label><input class="input" name="childAge" value="${esc(u.childAge || '')}" placeholder="예: 5세"></div>`}
      <hr class="sep">
      <b>비밀번호 변경 <span class="muted small">(바꿀 때만 입력)</span></b>
      <div class="field"><label>현재 비밀번호</label><input class="input" type="password" name="cur" autocomplete="current-password"></div>
      <div class="field"><label>새 비밀번호</label><input class="input" type="password" name="next" minlength="4" autocomplete="new-password" placeholder="4자 이상"></div>
      <button class="btn block" type="submit">저장</button>
    </form>`;
  }
  const consentTable = (c) => `<div class="card col" style="gap:10px"><h3>${esc(c.title)}</h3>
    <table class="tbl">${c.rows.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</table>
    <p class="muted small">${esc(c.note)}</p></div>`;
  function vPrivacy() {
    const u = me();
    const P = D.privacy;
    const back = u ? 'my' : 'signup';
    return `${top('개인정보 수집·이용 동의', back)}
    <div class="page">
      <p class="muted" style="font-size:14px">마주봄은 부모님의 정서 상태, 자녀의 발달 특성, 양육 기록처럼 민감한 정보를 다루기 때문에 꼭 필요한 정보만 수집하고 안전하게 보관해요.</p>
      ${consentTable(P.required)}
      ${u ? `<div class="notice"><span>✅</span><span>${u.consent?.at ? `${fmtDay(u.consent.at)}에 동의했어요.` : '가입 시 동의했어요.'} 필수 동의 철회는 회원 탈퇴로 가능해요.</span></div>` : ''}
      ${consentTable(P.optional)}
      ${u ? `<div class="card row between"><b>선택 동의</b><button class="switch ${u.consent?.optional ? 'on' : ''}" data-act="toggleOptional" aria-label="선택 동의"></button></div>` : ''}
      <div class="card col" style="gap:6px"><h3>비밀보장 안내</h3><p style="font-size:14px">커뮤니티와 전문가 게시판에서 나눈 이야기는 외부에 공유하지 않아요. 감정 기록은 ‘전문가와 공유’를 켠 기록만 전문가가 볼 수 있어요.</p></div>
    </div>`;
  }

  /* ---------------- router ---------------- */
  const R = [
    ['login', vLogin, { pub: true, nav: false }], ['signup', vSignup, { pub: true, nav: false }],
    ['home', vHome, { tab: 'home' }],
    ['learn', vLearn, { tab: 'learn' }], ['assess', vAssessList, { tab: 'learn' }], ['assess/:k', vAssess, { tab: 'learn' }],
    ['lesson/:n', vLesson, { tab: 'learn' }], ['quiz/:n', vQuiz, { tab: 'learn' }], ['shorts', vShorts, { tab: 'learn' }], ['care', vCare, { tab: 'learn' }],
    ['community', vCommunity, { tab: 'community' }], ['post/:id', vPost, { tab: 'community' }], ['write', vWrite, { tab: 'community' }],
    ['expert', vExpert, { tab: 'community' }], ['expert/new', vExpertNew, { tab: 'community' }], ['expert/:id', vExpertQ, { tab: 'community' }],
    ['record', vRecord, { tab: 'record' }], ['emotion', vEmotion, { tab: 'record' }], ['checklist', vChecklist, { tab: 'record' }], ['report', vReport, { tab: 'record' }],
    ['my', vMy, { tab: 'my' }], ['profile', vProfile, { tab: 'my' }], ['privacy', vPrivacy, { tab: 'my', any: true }],
    ['rules', vRules, { tab: 'community', any: true }], ['rules/:k', vRules, { tab: 'community', any: true }],
  ];
  let cur = { path: '' };
  function match(path) {
    const parts = path.split('/');
    for (const [pat, view, opt] of R) {
      const pp = pat.split('/');
      if (pp.length !== parts.length) continue;
      const params = {};
      if (pp.every((p, i) => (p[0] === ':' ? ((params[p.slice(1)] = decodeURIComponent(parts[i])), true) : p === parts[i]))) return { view, opt, params };
    }
    return null;
  }
  function render() {
    const path = location.hash.replace(/^#\/?/, '');
    if (!path) return go(me() ? 'home' : 'login');
    const m = match(path);
    if (!m) return go('home');
    if (!m.opt.pub && !m.opt.any && !me()) return go('login');
    if (m.opt.pub && me()) return go('home');
    if (path !== lastPath) { delete ui[path]; }
    cur = { path };
    after = [];
    const html = m.view(m.params);
    if (cur.path !== path || location.hash.replace(/^#\/?/, '') !== path) return; // redirected inside view
    const nav = m.opt.nav !== false && !!me();
    app.className = 'app' + (nav ? '' : ' no-nav');
    app.innerHTML = html + (nav ? tabbar(m.opt.tab) : '');
    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
    after.forEach((f) => f());
    if (me() && path === 'home') maybeCareNotify();
  }

  function maybeCareNotify() {
    const P = bucket('prefs');
    const t = dkey();
    if (!P.push || P.lastCare === t) return;
    P.lastCare = t; save();
    const care = D.care[Math.floor(Date.now() / 864e5) % D.care.length];
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(`마주봄 · ${care.title}`, { body: care.body, icon: 'assets/images/login_logo.png' }); } catch { /* some browsers need SW */ }
    }
    toast(`${care.icon} 오늘의 마음 쉼표: ${care.title}`);
  }

  /* ---------------- actions ---------------- */
  let recog = null;
  let pendingDate = null;
  const A = {
    async demo(el) { db.session = el.dataset.u === 'expert' ? 'u_exp' : 'u_demo'; save(); toast('체험 계정으로 로그인했어요'); go('home'); },
    forgot() { toast('운영진(프로그램 담당자)에게 문의해 주세요.'); },
    setRole(el) { st().role = el.dataset.v; render(); },
    logout() { db.session = null; save(); ui = {}; go('login'); },
    reset() {
      modal(`<h3>체험 데이터를 초기화할까요?</h3><p class="muted">이 브라우저에 저장된 모든 기록과 계정이 처음 상태로 돌아가요. 되돌릴 수 없어요.</p>
        <button class="btn block" data-act="resetYes">초기화</button><button class="btn line block" data-act="closeModal">취소</button>`);
    },
    async resetYes() { localStorage.removeItem(KEY); await seed(); ui = {}; closeModal(); toast('초기화했어요'); go('login'); },
    closeModal,
    senior() {
      modal(`<div class="result-hero"><img src="assets/images/flower_mascot.png" alt=""><div class="big" style="font-size:21px">선배 부모 활동 신청</div><p>다음 기수 부모님들께 경험을 나누는 선배 부모로 활동할 수 있어요. 5차시 선배 부모 강연과 Q&A, 커뮤니티 멘토 활동에 참여하게 돼요.</p></div>
        <button class="btn block" data-act="seniorYes">신청할게요</button><button class="btn line block" data-act="closeModal">다음에 할게요</button>`);
    },
    seniorYes() { me().senior = true; save(); closeModal(); toast('선배 부모 신청이 완료됐어요. 운영진이 곧 연락드릴게요 🌸'); render(); },
    toggleOptional() { const u = me(); u.consent ||= { at: dkey() }; u.consent.optional = !u.consent.optional; save(); toast(u.consent.optional ? '선택 항목에 동의했어요' : '선택 동의를 철회했어요'); render(); },
    withdraw() {
      modal(`<h3>정말 탈퇴할까요?</h3><p class="muted">계정과 검사 결과, 감정 기록, 체크리스트가 모두 삭제되고 되돌릴 수 없어요. 작성한 글과 댓글은 ‘탈퇴한 회원’으로 남아요.</p>
        <button class="btn block" data-act="withdrawYes" style="background:var(--rose)">탈퇴하기</button><button class="btn line block" data-act="closeModal">취소</button>`);
    },
    withdrawYes() {
      const id = db.session;
      db.users = db.users.filter((u) => u.id !== id);
      for (const k of ['assess', 'quiz', 'lessons', 'checklist', 'emotions', 'prefs', 'rulesSeen']) if (db[k]) delete db[k][id];
      db.session = null; save(); ui = {}; closeModal(); toast('탈퇴가 완료됐어요. 그동안 함께해 주셔서 고마워요'); go('login');
    },
    rules: showRules,
    rulesOk() { db.rulesSeen[db.session] = true; save(); closeModal(); if (cur.path.startsWith('rules')) { toast('이용규칙을 확인했어요'); render(); } },
    quickMood(el) {
      const emo = bucket('emotions'); const k = dkey();
      emo[k] = { ...(emo[k] || { memo: '', shared: false }), mood: el.dataset.m, ts: Date.now() };
      save(); toast(`오늘의 마음 ‘${moodOf(el.dataset.m).label}’을 기록했어요`); render();
    },
    watched(el) { const L = bucket('lessons'); (L.watched ||= {})[el.dataset.n] = !L.watched[el.dataset.n]; save(); render(); },
    lessonDone(el) {
      const L = bucket('lessons'); L.done ||= {}; const n = el.dataset.n;
      L.done[n] = !L.done[n]; save();
      if (L.done[n]) { toast(`${n}차시 완료! 수고 많으셨어요 🌱`); go('learn'); } else render();
    },
    qAns(el) { const s = st(); const q = D.quizzes[cur.path.split('/')[1]][s.i]; s.ans[s.i] = q.type === 'mc' ? +el.dataset.v : el.dataset.v; render(); },
    qCheck() {
      const s = st(); const n = cur.path.split('/')[1]; const q = D.quizzes[n][s.i];
      if (q.type === 'short') s.ans[s.i] = document.getElementById('shortAns')?.value || '';
      if (s.ans[s.i] === undefined || s.ans[s.i] === '') return toast('답을 선택하거나 입력해 주세요');
      s.checked = true; if (isCorrect(q, s.ans[s.i])) s.score++; render();
    },
    qNext() {
      const s = st(); const n = cur.path.split('/')[1]; s.i++; s.checked = false;
      if (s.i >= D.quizzes[n].length) { bucket('quiz')[n] = { score: s.score, total: D.quizzes[n].length, date: dkey() }; save(); }
      render();
    },
    quizRetry() { delete ui[cur.path]; render(); },
    scale(el) { st().ans[el.dataset.i] = +el.dataset.v; const y = window.scrollY; render(); window.scrollTo(0, y); },
    retake() { const s = st(); s.retake = true; s.ans = {}; render(); },
    assessSubmit(el) {
      const k = el.dataset.k; const s = st();
      bucket('assess')[k] = { ...scoreAssess(k, s.ans), date: dkey(), answers: s.ans };
      save(); s.retake = false; render();
    },
    shortType(el) { st().t = +el.dataset.i; render(); },
    careCat(el) { st().c = el.dataset.v; render(); },
    async togglePush() {
      const P = bucket('prefs');
      if (!P.push && 'Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }
      P.push = !P.push; if (P.push) P.lastCare = null; save();
      toast(P.push ? '마음 쉼표 알림을 켰어요' : '알림을 껐어요');
      render();
    },
    cat(el) { st().cat = el.dataset.v; render(); },
    like(el) {
      const p = db.posts.find((x) => x.id === el.dataset.id);
      const i = p.likes.indexOf(db.session); i >= 0 ? p.likes.splice(i, 1) : p.likes.push(db.session);
      save(); render();
    },
    delPost(el) {
      modal(`<h3>글을 삭제할까요?</h3><p class="muted">댓글도 함께 사라지고 되돌릴 수 없어요.</p><button class="btn block" data-act="delPostYes" data-id="${el.dataset.id}">삭제</button><button class="btn line block" data-act="closeModal">취소</button>`);
    },
    delPostYes(el) { db.posts = db.posts.filter((p) => p.id !== el.dataset.id); save(); closeModal(); go('community'); },
    delComment(el) {
      const p = db.posts.find((x) => x.id === el.dataset.p);
      p.comments = p.comments.filter((c) => c.id !== el.dataset.id); save(); render();
    },
    qFilter(el) { st().f = el.dataset.v; render(); },
    qField(el) { st().field = el.dataset.v; render(); },
    limit(el, e) { e.preventDefault(); toast('오늘 질문 횟수를 모두 사용했어요'); },
    delQ(el) { db.questions = db.questions.filter((q) => q.id !== el.dataset.id); save(); toast('질문을 삭제했어요'); go('expert'); },
    month(el) { const s = st(); const d = fromKey(s.m + '-01'); d.setMonth(d.getMonth() + +el.dataset.d); s.m = dkey(d).slice(0, 7); render(); },
    pickDate(el) {
      if (cur.path === 'emotion') { const s = st(); stopRec(); Object.assign(s, { k: el.dataset.k, mood: undefined }); render(); window.scrollTo(0, 0); }
      else { pendingDate = el.dataset.k; go('emotion'); }
    },
    pickMood(el) { st().mood = el.dataset.m; render(); },
    toggleShare() { const s = st(); s.shared = !s.shared; render(); },
    mic() {
      const s = st();
      if (s.rec) return stopRec();
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('이 브라우저는 음성 입력을 지원하지 않아요 (Chrome·Safari 권장)');
      recog = new SR(); recog.lang = 'ko-KR'; recog.interimResults = false; recog.continuous = true;
      recog.onresult = (ev) => {
        let txt = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) txt += ev.results[i][0].transcript;
        if (!txt) return;
        const ta = document.getElementById('memo');
        s.memo = ((ta ? ta.value : s.memo) + (s.memo ? ' ' : '') + txt.trim()).trim();
        if (ta) ta.value = s.memo;
      };
      recog.onerror = (ev) => { toast(ev.error === 'not-allowed' ? '마이크 권한을 허용해 주세요' : '음성 인식이 멈췄어요'); stopRec(); };
      recog.onend = () => { if (s.rec) { s.rec = false; if (cur.path === 'emotion') render(); } };
      try { recog.start(); s.rec = true; render(); } catch { toast('음성 입력을 시작할 수 없어요'); }
    },
    saveEmotion() {
      const s = st(); stopRec();
      const ta = document.getElementById('memo'); if (ta) s.memo = ta.value;
      bucket('emotions')[s.k] = { mood: s.mood, memo: s.memo.trim(), shared: s.shared, ts: Date.now() };
      save(); toast('마음을 기록했어요. 오늘도 수고했어요 💜'); s.mood = undefined; render();
    },
    delEmotion() { const s = st(); delete bucket('emotions')[s.k]; save(); s.mood = undefined; toast('기록을 지웠어요'); render(); },
    check(el) {
      const cl = bucket('checklist'); cl.log ||= {}; const t = dkey();
      const arr = cl.log[t] || []; arr[+el.dataset.i] = !arr[+el.dataset.i]; cl.log[t] = arr;
      save(); if (arr[+el.dataset.i]) toast('잘하셨어요! 🌱'); render();
    },
    clEdit() { const s = st(); s.edit = !s.edit; render(); },
    csv() {
      const { rows, items } = reportData();
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const head = ['날짜', '감정', '메모', ...items.map((it, i) => `체크${i + 1}: ${it}`)];
      const lines = [head.map(q).join(',')].concat(rows.map((r) => [r.k, r.e ? moodOf(r.e.mood).label : '', r.e?.memo || '', ...items.map((_, i) => (r.c[i] ? 'O' : ''))].map(q).join(',')));
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `majubom_${me().nickname}_${dkey()}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
  function stopRec() { const s = ui.emotion; if (recog) { try { recog.stop(); } catch { /* */ } recog = null; } if (s?.rec) { s.rec = false; if (cur.path === 'emotion') render(); } }

  const F = {
    async profile(d) {
      const u = me();
      if (d.next) {
        if (!d.cur || u.pw !== (await sha(d.cur))) return toast('현재 비밀번호가 맞지 않아요');
        u.pw = await sha(d.next);
      }
      u.nickname = d.nickname.trim();
      if (u.role === 'expert') u.title = d.title?.trim(); else u.childAge = d.childAge?.trim();
      save(); toast('정보를 저장했어요'); go('my');
    },
    async login(d) {
      const u = db.users.find((x) => x.username === d.username.trim());
      if (!u || u.pw !== (await sha(d.password))) return toast('아이디 또는 비밀번호를 확인해 주세요');
      db.session = u.id; save(); go('home');
    },
    async signup(d) {
      const s = st();
      const username = d.username.trim();
      if (!/^[a-zA-Z0-9_]{3,}$/.test(username)) return toast('아이디는 영문/숫자 3자 이상이에요');
      if (db.users.some((x) => x.username === username)) return toast('이미 사용 중인 아이디예요');
      if (s.role === 'expert' && d.code !== (D.expertCode || 'majubom2026')) return toast('전문가 인증 코드가 올바르지 않아요');
      const u = { id: 'u_' + uid(), username, pw: await sha(d.password), nickname: d.nickname.trim(), role: s.role, childAge: d.childAge?.trim(), title: d.title?.trim(), createdAt: Date.now(), consent: { at: dkey(), optional: !!d.optional } };
      db.users.push(u); db.session = u.id; save();
      toast(`환영해요, ${u.nickname}님!`);
      go(u.role === 'parent' ? 'assess' : 'home');
    },
    post(d) {
      const p = { id: 'p' + uid(), authorId: db.session, cat: st().cat || '일상 나눔', title: d.title.trim(), body: d.body.trim(), createdAt: Date.now(), likes: [], comments: [] };
      db.posts.push(p); save(); toast('글을 올렸어요'); go('post/' + p.id);
    },
    comment(d, f) {
      const p = db.posts.find((x) => x.id === f.dataset.id);
      const before = gradeOf(db.session).key;
      p.comments.push({ id: 'c' + uid(), authorId: db.session, body: d.body.trim(), createdAt: Date.now() });
      save(); render();
      const g = gradeOf(db.session);
      if (!isExpert() && g.key !== before) {
        modal(`<div class="result-hero"><img src="${g.img}" alt=""><div class="big">${g.name} 등급이 되었어요!</div><p>${esc(g.desc)}</p><span class="chip yellow">🎁 ${esc(g.reward)}</span></div><button class="btn block" data-act="closeModal">고마워요</button>`);
      } else toast('따뜻한 댓글 고마워요 💜');
    },
    question(d) {
      const u = me();
      if (questionsToday(u.id) >= dailyLimit(u.id)) return toast('오늘 질문 횟수를 모두 사용했어요');
      const q = { id: 'q' + uid(), authorId: u.id, field: st().field, childAge: d.childAge.trim(), situation: d.situation.trim(), question: d.question.trim(), public: !!d.public, createdAt: Date.now(), answer: null };
      db.questions.push(q); save(); toast('질문을 보냈어요. 답변이 오면 여기서 확인할 수 있어요'); go('expert/' + q.id);
    },
    answer(d, f) {
      const q = db.questions.find((x) => x.id === f.dataset.id);
      q.answer = { expertId: db.session, body: d.body.trim(), createdAt: Date.now() };
      save(); toast('답변을 등록했어요'); render();
    },
    clItems(d) {
      const items = [d.i0, d.i1, d.i2].map((x) => x.trim()).filter(Boolean);
      if (!items.length) return toast('항목을 하나 이상 적어 주세요');
      bucket('checklist').items = items; save(); st().edit = false; toast('항목을 저장했어요'); render();
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !A[el.dataset.act]) return;
    if (el.tagName === 'BUTTON' || el.dataset.act === 'limit') e.preventDefault();
    A[el.dataset.act](el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target; const fn = F[f.dataset.form];
    if (!fn) return;
    e.preventDefault();
    fn(Object.fromEntries(new FormData(f)), f);
  });
  window.addEventListener('hashchange', () => { if (cur.path === 'emotion') stopRec(); closeModal(); render(); });

  load().then(render);
})();

// 서비스 워커 등록 (홈 화면 설치·오프라인 지원)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
