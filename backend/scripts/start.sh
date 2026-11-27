#!/usr/bin/env bash
# 서버 켜기 (이미 떠 있으면 끄고 다시 켠다). 0.0.0.0:6000 에서 실행 → 공개 주소로 접속됨.
#   cd ~/work/hackathon-campus-notice-/backend && bash scripts/start.sh
cd "$(dirname "$0")/.." || exit 1
pkill -f "uvicorn app.main:app" 2>/dev/null
sleep 1
mkdir -p data
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 6000 >> data/server.log 2>&1 &
sleep 2
if curl -s -m 3 http://127.0.0.1:6000/api/health >/dev/null; then
  echo "서버가 켜졌어요. 로그: backend/data/server.log"
else
  echo "서버가 켜지지 않았어요. 로그를 확인하세요: tail -20 backend/data/server.log"
fi
