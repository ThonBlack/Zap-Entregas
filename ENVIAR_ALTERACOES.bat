@echo off
echo ==========================================
echo    SINCRONIZANDO: ENVIAR ALTERACOES
echo ==========================================
echo.
echo 1. Adicionando arquivos...
git add .
echo.
echo 2. Salvando alteracoes (Commit)...
set /p msg="Digite uma mensagem sobre o que mudou: "
git commit -m "%msg%"
echo.
echo 3. Enviando para a Nuvem (GitHub)...
git push
echo.
echo ==========================================
echo    SUCESSO! CODIGO ENVIADO.
echo ==========================================
pause
