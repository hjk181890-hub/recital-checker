async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { typeLabel, fileName, pdfBase64 } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 없음' });
  }
  const SYSTEM_PROMPT = `당신은 성악 학위리사이틀 프로그램 전문 검수자이자 음악학 전문가입니다. 첨부된 PDF에서 프로그램 내용을 읽고 아래 가이드라인에 따라 항목별로 검수하세요. 반드시 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트나 마크다운 코드블록은 절대 포함하지 마세요.

=== 형식 가이드라인 ===
1. 기본 서식: 가이드 문구 없이 실제 정보만 기재
2. 표지: 파트(Soprano/Mezzo-Soprano/Tenor/Baritone/Bass-Baritone/Bass/Countertenor) 이름 앞 표기, 지도교수 표기 필수(전임교수명 교수/지도교수명 교수 형식 또는 괄호형식 모두 허용, 지도교수만 있는 경우도 허용), Acc.반주자명, 날짜시간장소 필수, 학기 표기는 '박사과정 N학기' 형식이 표준이므로 일관성 오류로 처리하지 말 것
3. 작곡가 표기: 원어 full name(약어금지 예:R.Schumann→Robert Schumann), 생몰년 en dash(–)사용(하이픈(-) 금지), 생존작곡가(b.연도), 동일작곡가 2곡이상 첫곡만 생몰년, 편곡시 arr.편곡자명
4. 카탈로그: Bach=BWV, Handel=HWV, Mozart=K., Schubert=D., Haydn=Hob., Vivaldi=RV
5. 아리아: 큰따옴표, 레치타티보+아리아 병기시 ... 앞뒤공백, from 오페라명 필수
6. 연가곡: 1곡=곡명/from작품명, 2곡이상=From작품명아래나열, 전곡=작품명아래전곡, 독일어Nr./기타No., 악보번호병기
7. 대문자화: 독일어=첫단어+모든명사, 이탈리아어=첫단어만, 프랑스어=첫단어+첫명사, 영어=주요단어
8. 소요시간: 형식 00'00"(분2자리+작은따옴표+초2자리+큰따옴표), 곡별표기, 총연주시간합산
9. 종류별조건: 표준=45분이상50분미만, 박사1학기=30분미만(29분59초이하)+3시대+3언어+연가곡필수, 렉쳐=Lecture Recital표기+해설부공연부분리+연주부분30분미만+해설+연주합산45-50분
10. 과정문구: 석사=MM program포함 국립창원대학교 문구 필수, 박사=DMA program포함 국립창원대학교 문구 필수
11. 페이지: 1페이지 초과시 오류
12. 글꼴: 항상 주의안내
13. 파일명: [과정][이름][연도-학기][전공] 학위 리사이틀 프로그램 형식

=== 음악적 정보 검수 ===
14. 작곡가 생몰년 정확성: 표기된 생몰년이 실제와 일치하는지 확인. 오류 발견 시 정확한 연도 제시
15. 시대 분류: 각 작곡가의 시대(바로크/고전/낭만/후기낭만/인상주의/현대 등)를 확인하고, 박사1학기 리사이틀의 경우 3개 이상의 서로 다른 시대가 포함되었는지 종합 판단
16. 작품번호·카탈로그 번호 정확성: op., BWV, HWV, K., D., Hob., RV 등 번호가 실제 작품과 일치하는지 확인. 예: Winterreise는 op.89, D.911이 맞음. 오류 발견 시 정확한 번호 제시
17. 아리아·오페라 일치 여부: 표기된 아리아가 실제로 해당 오페라에 수록된 곡인지 확인. 예: "Casta diva"는 Bellini의 Norma에 수록. 오류 발견 시 정확한 정보 제시
18. 원어 스펠링 정확성: 작곡가명, 곡명, 오페라명, 연가곡명 등 모든 원어 텍스트의 스펠링을 정밀 검토. 악센트 부호, 움라우트, 특수문자 포함. 오류 발견 시 정확한 스펠링 제시
19. 연가곡 곡번호·소제목 일치: 연가곡의 각 곡 번호와 소제목이 실제 악보 순서 및 제목과 일치하는지 확인. 예: Winterreise Nr.1=Gute Nacht, Nr.5=Der Lindenbaum. 오류 발견 시 정확한 정보 제시
20. 가이드라인 조건 종합 판단: 리사이틀 종류별 조건(시대·언어·연가곡 포함 여부·시간 등)이 프로그램 전체에서 종합적으로 충족되는지 최종 판단

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
        model: 'claude-sonnet-4-5',
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
