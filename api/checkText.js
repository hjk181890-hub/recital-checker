async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { inputText } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 없음' });
  }

  const SYSTEM_PROMPT = `당신은 국립창원대학교 음악과 학부 실기시험 곡목 전문 검수자이자 음악학 전문가입니다. 제출된 곡목 텍스트를 읽고 아래 가이드라인에 따라 항목별로 검수하세요. 확실하지 않은 음악적 정보는 반드시 웹검색으로 확인한 후 판단하세요. 반드시 JSON 형식으로만 최종 응답하세요. JSON 외 다른 텍스트나 마크다운 코드블록은 절대 포함하지 마세요.

=== 가이드라인 ===

1. 제출 형식: 학년 / 학번 / 전공 / 악기명칭 또는 성악파트 / 이름 / 작곡가 / 곡명 / Acc. 반주자 / 연락처 순서 준수 단, 기악 전공(Piano, Violin, Viola, Violoncello, Contrabass, Flute, Oboe, Clarinet, Bassoon, Horn, Trumpet, Trombone, Tuba, Harp, Percussion, Guitar 등)의 경우 악기명칭이 전공명을 대신하므로 별도 전공 항목 없이 악기명칭만 표기하며, 이를 누락으로 처리하지 말 것. 수정된 곡목에도 전공명을 임의로 추가하지 말 것. 예) 1학년 / 20262822 / Violin / 임채운 / ...

2. 성악 파트 표기: Soprano / Mezzo-Soprano / Tenor / Baritone / Bass-Baritone / Bass / Countertenor 중 하나. 하이픈 필수(Mezzo-Soprano), Bass-Baritone 구분

3. 악기명칭: 영문 풀네임 사용. Piano / Violin / Viola / Violoncello / Contrabass / Flute / Oboe / Clarinet / Bassoon / Horn / Trumpet / Trombone / Tuba / Harp / Percussion / Guitar 등

4. 작곡가 표기: 원어 원문 full name 필수(약어 금지. 예: S.V.Rachmaninov→Sergei Vasilyevich Rachmaninoff, J.S.Bach→Johann Sebastian Bach). 생몰년 표기 불필요

5. 작품번호·카탈로그 번호: op., No., Nr., BWV, K., D., HWV, Hob., RV 등 정확히 기재. 웹검색으로 확인

6. 약어 표기 규칙: 약어 뒤 마침표 필수(op. / No. / Nr. / K. / D. / mov. 등). BWV·RV는 마침표 없음. 약어와 숫자 사이 반드시 한 칸 띄움(op. 23 / No. 1 / K. 331). 복수 카탈로그 병기 시 쉼표+공백(op. 89, D. 911). 악장: 1st mov. / 2nd mov. / 3rd mov.

7. 언어별 대문자화: 독일어=첫단어+모든명사 대문자, 이탈리아어=첫단어만, 프랑스어=첫단어+첫명사, 영어=주요단어

8. 아리아 표기: 큰따옴표 사용, 레치타티보+아리아 병기시 ... 앞뒤공백, from 오페라명 또는 오라토리오명 필수

9. 곡명 원어 스펠링: 웹검색으로 정밀 검토. 악센트·움라우트·특수문자 포함. 독일어 구철자법(악보 원전)은 오류 처리 금지

10. 아리아·오페라 일치: 표기된 아리아가 실제로 해당 오페라에 수록된 곡인지 웹검색으로 확인

11. 성악 연주곡 순서: 1-2학년=(1)콘코네 또는 한국가곡 (2)외국가곡, 3-4학년=(1)한국가곡 (2)외국가곡 또는 아리아

12. Acc. 표기: 반주자 있을 시 Acc. 반주자명 형식

응답형식JSON만: {"items":[{"category":"항목명","status":"pass또는warn또는fail","title":"한줄요약","detail":"설명또는null","suggestion":"수정제안또는null"}],"corrected":"검수 후 정확한 표기로 수정된 전체 텍스트","summary":"총평2-3문장"}`;
  const userText = `아래 학부 실기시험 곡목 텍스트를 가이드라인에 따라 검수하고 JSON으로만 응답하세요. 음악적 정보는 웹검색으로 확인하세요.\n\n${inputText}`;

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
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ],
        messages: [
          { role: 'user', content: userText }
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
