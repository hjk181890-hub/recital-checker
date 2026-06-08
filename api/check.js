async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { typeLabel, fileName, pdfBase64 } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 없음' });
  }
  const SYSTEM_PROMPT = `당신은 성악 학위리사이틀 프로그램 전문 검수자입니다. 첨부된 PDF에서 프로그램 내용을 읽고 아래 가이드라인에 따라 항목별로 검수하세요. 반드시 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트나 마크다운 코드블록은 절대 포함하지 마세요.
가이드라인:
1. 기본 서식: 가이드 문구 없이 실제 정보만 기재
2. 표지: 파트(Soprano/Mezzo-Soprano/Tenor/Baritone/Bass-Baritone/Bass/Countertenor) 이름 앞 표기, 지도교수 병기(전임/지도교수명 교수), Acc.반주자명, 날짜시간장소 필수
3. 작곡가: 원어 full name(약어금지), 생몰년 en dash(–)사용(하이픈금지), 생존작곡가(b.연도), 동일작곡가 2곡이상 첫곡만 생몰년, 편곡시 arr.편곡자명
4. 카탈로그: Bach=BWV, Handel=HWV, Mozart=K., Schubert=D., Haydn=Hob., Vivaldi=RV
5. 아리아: 큰따옴표, 레치타티보+아리아 병기시 ... 앞뒤공백, from 오페라명 필수
6. 연가곡: 1곡=곡명/from작품명, 2곡이상=From작품명아래나열, 전곡=작품명아래전곡, 독일어Nr./기타No., 악보번호병기
7. 대문자화: 독일어=첫단어+모든명사, 이탈리아어=첫단어만, 프랑스어=첫단어+첫명사, 영어=주요단어
8. 소요시간: 형식 00분00초(작은따옴표분큰따옴표초), 곡별표기, 총연주시간합산
9. 종류별: 표준=45-50분, 박사1학기=30분미만+3시대+3언어+연가곡, 렉쳐=Lecture Recital+해설부공연부분리+연주30분미만+합산45-50분
10. 과정문구: 석사=MM program, 박사=DMA program 국립창원대학교 문구 필수
11. 마지막곡: 아리아
12. 페이지: 1페이지 초과시 오류
13. 글꼴: 항상 주의안내
14. 파일명: [과정][이름][연도-학기][전공] 학위 리사이틀 프로그램
응답형식JSON만: {"items":[{"category":"항목명","status":"pass또는warn또는fail","title":"한줄요약","detail":"설명또는null","suggestion":"수정제안또는null"}],"summary":"총평2-4문장"}`;
  const userText = `리사이틀 종류: ${typeLabel}\nPDF 파일명: ${fileName}\n\n위 PDF를 가이드라인에 따라 검수하고 JSON으로만 응답하세요. PDF 페이지 수도 확인하세요.`;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
              { type: 'text', text: userText }
            ]
          },
          { role: 'assistant', content: '{' }
        ]
      })
    });
    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'API 오류' });
    }
    const raw = '{' + data.content.map(i => i.text || '').join('');
    let parsed;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch(e) {
      return res.status(500).json({ error: '파싱오류: ' + raw.substring(0, 200) });
    }
    return res.status(200).json(parsed);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
