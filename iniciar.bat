@echo off
title Calculadora BCV
cd /d "%~dp0"
echo Iniciando Calculadora BCV en http://localhost:8000
python server.py
pause