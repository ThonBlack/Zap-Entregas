@echo off
echo ==========================================
echo    SINCRONIZANDO: BAIXAR ALTERACOES
echo ==========================================
echo.
echo Baixando atualizacoes da Nuvem...
git pull
echo.
echo Instalando novas dependencias (se houver)...
call npm install
echo.
echo ==========================================
echo    SEU CODIGO ESTA ATUALIZADO!
echo ==========================================
pause
