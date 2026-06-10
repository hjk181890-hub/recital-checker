async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { typeLabel, fileName, pdfBase64 } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 없음' });
  }

  // extract.py 먼저 호출
  let extractData = {
    pageCount: 1,
    firstLineText: '',
    colorIssues: [],
    fontIssues: [],
    sizeIssues: []
  };
  try {
    const host = req.headers.host || 'recital-checker.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const extractRes = await fetch(`${protocol}://${host}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64 })
    });
    if (extractRes.ok) {
      extractData = await extractRes.json();
    }
  } catch(e) {
    // extract 실패 시 기본값으로 계속 진행
  }

  const fontReport = `
=== PDF 자동 추출 정보 (검수 참고용) ===
총 페이지 수: ${extractData.pageCount}페이지
첫 줄 텍스트: "${extractData.firstLineText}"
비검정 글자: ${extractData.colorIssues.length}건${extractData.colorIssues.length > 0 ? ' — ' + extractData.colorIssues.slice(0,3).map(i => `"${i.text}"(${i.color}, ${i.page}p)`).join(', ') : ''}
비허용 폰트: ${extractData.fontIssues.length}건${extractData.fontIssues.length > 0 ? ' — ' + extractData.fontIssues.slice(0,3).map(i => `"${i.text}"(${i.font}, ${i.page}p)`).join(', ') : ''}
비정상 크기: ${extractData.sizeIssues.length}건${extractData.sizeIssues.length > 0 ? ' — ' + extractData.sizeIssues.slice(0,3).map(i => `"${i.text}"(${i.size}pt, ${i.page}p)`).join(', ') : ''}
`;

  const SYSTEM_PROMPT = `당신은 성악 학위리사이틀 프로그램 전문 검수자이자 음악학 전문가입니다. 첨부된 PDF에서 프로그램 내용을 읽고 아래 가이드라인에 따라 항목별로 검수하세요. 확실하지 않은 음악적 정보는 반드시 웹검색으로 확인한 후 판단하세요. 반드시 JSON 형식으로만 최종 응답하세요. JSON 외 다른 텍스트나 마크다운 코드블록은 절대 포함하지 마세요.

=== 형식 가이드라인 ===
0. 붙임 표시·예시 문구 삭제 여부: PDF 첫 줄이 반드시 학년도(예: 2026학년도)로 시작해야 함. 위에 제공된 자동 추출 정보의 첫 줄 텍스트를 확인할 것. 예시 문구·붙임 표시가 남아있으면 오류
1. 기본 서식: 가이드 문구 없이 실제 정보만 기재. 국립창원대학교 공식 마크(워터마크) 삭제 금지
2. 글꼴·색상: 위 자동 추출 정보를 반드시 활용하여 검수할 것. 비검정 글자 건수가 1건 이상이면 반드시 ❌ 오류로 처리하고 해당 텍스트와 색상값을 detail에 명시. 비허용 폰트 건수가 1건 이상이면 반드시 ❌ 오류로 처리. 비검정·비허용 폰트가 0건이면 ✅ 통과로 처리. 자동 추출 정보가 없는 경우에만 ⚠️ 주의 안내
3. 표지: 파트(Soprano/Mezzo-Soprano/Tenor/Baritone/Bass-Baritone/Bass/Countertenor) 이름 앞 표기 필수, 지도교수 표기 필수(괄호 형식 허용), Acc.반주자명 필수, 날짜·시간·장소 필수. 제목부 줄간격 160%
4. 작곡가 표기: 원어 full name 필수(약어 금지), 생몰년 en dash(–) 사용(하이픈(-) 금지), 생존작곡가 (b.연도), 동일작곡가 2곡이상 첫곡만 생몰년, 편곡시 arr.편곡자명
5. 카탈로그: Bach=BWV, Handel=HWV, Mozart=K., Schubert=D., Haydn=Hob., Vivaldi=RV
6. 아리아: 큰따옴표, 레치타티보+아리아 병기시 ... 앞뒤공백, from 오페라명 필수
7. 연가곡·작품 소제목: 1곡발췌=곡명/from작품명, 2곡이상=From작품명아래나열, 전곡=작품명아래전곡, 독일어권Nr./기타No., 악보번호병기
8. 대문자화: 독일어=첫단어+모든명사, 이탈리아어=첫단어만, 프랑스어=첫단어+첫명사, 영어=주요단어
9. 소요시간: 형식 반드시 00'00" (분 반드시 2자리, 예: 03'08" — 3'08" 형식은 ❌ 오류). 곡별표기, Intermission 시간 기재, Intermission 미포함 실연주시간 총합 우측 아래 기재
10. 종류별조건: 표준=45분이상50분미만, 박사1학기=30분미만+3시대+3언어+연가곡필수, 렉쳐=Lecture Recital표기+해설부·공연부분리+연주부분30분미만+합산45-50분
11. 과정문구: 석사=국립창원대학교 일반대학원 석사과정...MM program 필수, 박사=국립창원대학교 일반대학원 박사과정...DMA program 필수. 제시 양식에서 수정 금지
12. 페이지: 위에 제공된 자동 추출 정보의 총 페이지 수를 확인. 1페이지 초과시 오류
13. 파일명: 형식은 '과정 이름 연도-학기 전공 학위 리사이틀 프로그램' (공백 구분, 대괄호 없음)

=== 음악적 정보 검수 (불확실한 경우 웹검색으로 확인) ===
14. 작곡가 생몰년 정확성
15. 시대 분류 (바로크/고전/낭만/현대 등), 박사1학기는 3시대 이상 포함 여부
16. 작품번호·카탈로그 번호 정확성
17. 아리아·오페라 수록 일치 여부
18. 원어 스펠링 정확성 (움라우트·악센트 포함). 독일어 구철자법(악보 원전 표기)은 오류 처리 금지
19. 연가곡·작품 소제목 일치 여부
20. 가이드라인 조건 종합 판단

응답형식JSON만: {"items":[{"category":"항목명","status":"pass또는warn또는fail","title":"한줄요약","detail":"설명또는null","suggestion":"수정제안또는null"}],"summary":"총평2-4문장"}`;
  const userText = `${fontReport}\n리사이틀 종류: ${typeLabel}\nPDF 파일명: ${fileName}\n\n위 PDF와 자동 추출 정보를 가이드라인에 따라 검수하고 JSON으로만 응답하세요. 음악적 정보는 웹검색으로 확인하세요.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
              { type: 'text', text: userText }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'API 오류' });
    }

    const raw = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      parsed = JSON.parse(clean.substring(jsonStart, jsonEnd + 1));
    } catch(e) {
      return res.status(500).json({ error: '파싱오류: ' + raw.substring(0, 200) });
    }

    return res.status(200).json(parsed);

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
