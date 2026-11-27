#!/usr/bin/env bash
# 서버 끄기
pkill -f "uvicorn app.main:app" && echo "서버를 껐어요." || echo "떠 있는 서버가 없어요."
