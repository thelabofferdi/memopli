.PHONY: install api web build-web test

install:
	python3 -m venv .venv && ./.venv/bin/pip install -r backend/requirements.txt
	cd frontend && npm install

api:
	./.venv/bin/uvicorn app.main:app --reload --app-dir backend --port 8000 \
		--no-proxy-headers --no-access-log

web:
	cd frontend && npm run dev

build-web:
	cd frontend && npm run build
	cp -r frontend/dist backend/app/static

test:
	./.venv/bin/python -m pytest backend/tests -q
