import Link from "next/link";

// Página pública exigida pela Play Store (e boa prática em qualquer app que
// pede localização). Sem login, sem dado dinâmico — só texto.
export const metadata = {
    title: "Política de Privacidade — Zap Entregas",
    description: "Quais dados o Zap Entregas coleta e por quê.",
};

const ATUALIZADO_EM = "23 de agosto de 2026";
const CONTATO = "thonblack7@gmail.com";

export default function PrivacidadePage() {
    return (
        <div className="min-h-screen bg-zinc-50">
            <header className="bg-white p-4 shadow-sm flex items-center gap-4">
                <Link href="/" className="font-bold text-lg text-green-600">Zap Entregas</Link>
                <div className="text-sm text-zinc-500">Política de Privacidade</div>
            </header>

            <main className="max-w-2xl mx-auto p-4 pb-12">
                <article className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-zinc-200 space-y-6 text-zinc-800 leading-relaxed">
                    <div>
                        <h1 className="font-bold text-2xl text-zinc-900">Política de Privacidade</h1>
                        <p className="text-sm text-zinc-500 mt-1">Última atualização: {ATUALIZADO_EM}</p>
                    </div>

                    <p>
                        O <strong>Zap Entregas</strong> é um aplicativo de gestão de entregas usado por lojas
                        e pelos entregadores (motoboys) que trabalham com elas. Esta página explica, em
                        linguagem simples, quais dados o app guarda, por que guarda e o que você pode fazer
                        a respeito.
                    </p>

                    <Secao titulo="1. Quem é o responsável">
                        <p>
                            O Zap Entregas é operado pela Epic Corp (Uberaba, MG, Brasil). Para qualquer
                            dúvida sobre seus dados, escreva para <a className="text-green-700 underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>.
                        </p>
                    </Secao>

                    <Secao titulo="2. Quais dados coletamos">
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong>Dados de cadastro:</strong> nome, telefone, e-mail (opcional) e senha
                                (guardada de forma embaralhada — nem nós conseguimos lê-la).
                            </li>
                            <li>
                                <strong>Localização do entregador:</strong> enquanto o motoboy está com o app
                                aberto em uma corrida, o app envia a posição do aparelho de tempos em tempos.
                                Isso serve para a loja e o cliente acompanharem a entrega no mapa e para
                                confirmar que a entrega foi feita no endereço certo. A localização
                                <strong> não é coletada</strong> com o app fechado.
                            </li>
                            <li>
                                <strong>Dados das entregas:</strong> endereço de destino, nome e telefone do
                                cliente informados pela loja, valor a receber, forma de pagamento e
                                observações. Esses dados pertencem à loja e são usados só para realizar a
                                entrega.
                            </li>
                            <li>
                                <strong>Foto de perfil:</strong> opcional, enviada por você.
                            </li>
                            <li>
                                <strong>Conta Google (opcional):</strong> se você escolher entrar com o
                                Google, guardamos apenas o identificador e o e-mail da conta para reconhecer
                                você no próximo acesso. Não temos acesso à sua senha do Google nem a outros
                                dados da conta.
                            </li>
                            <li>
                                <strong>Chave de acesso por digital/biometria (opcional):</strong> se ativar
                                o desbloqueio por digital, o aparelho gera uma chave de segurança e nos envia
                                só a parte pública. Sua digital nunca sai do celular.
                            </li>
                            <li>
                                <strong>Notificações:</strong> para avisar sobre corridas novas, guardamos o
                                endereço técnico de entrega de notificações do seu navegador ou aparelho.
                            </li>
                        </ul>
                    </Secao>

                    <Secao titulo="3. Para que usamos">
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Fazer o app funcionar: criar, aceitar, acompanhar e encerrar entregas.</li>
                            <li>Mostrar a posição do entregador durante a corrida.</li>
                            <li>Calcular o pagamento das corridas e o acerto entre loja e entregador.</li>
                            <li>Enviar notificações de corridas e atualizações.</li>
                            <li>Manter a conta segura (login, verificação em duas etapas, digital).</li>
                        </ul>
                        <p className="mt-2">
                            <strong>Não vendemos</strong> seus dados e <strong>não usamos</strong> para
                            publicidade.
                        </p>
                    </Secao>

                    <Secao titulo="4. Com quem compartilhamos">
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong>Entre loja, entregador e cliente:</strong> a loja vê a posição do
                                entregador durante a corrida; o entregador vê o endereço e os dados de
                                contato necessários para entregar; o cliente vê apenas o andamento da sua
                                própria entrega, por um link exclusivo.
                            </li>
                            <li>
                                <strong>Serviços de mapa:</strong> para transformar endereços em pontos no
                                mapa usamos o OpenStreetMap (Nominatim), o ViaCEP e, quando configurado, o
                                Google Maps. Só o endereço da entrega é enviado a eles — nunca seu nome ou
                                telefone.
                            </li>
                            <li>
                                <strong>Google:</strong> apenas se você escolher entrar com a conta Google.
                            </li>
                        </ul>
                        <p className="mt-2">Fora isso, só compartilhamos dados se a lei exigir.</p>
                    </Secao>

                    <Secao titulo="5. Por quanto tempo guardamos">
                        <p>
                            Os dados de cadastro ficam enquanto a conta existir. O histórico de entregas e
                            de pagamentos fica guardado para fins de conferência financeira entre a loja e o
                            entregador. A localização em tempo real é substituída a cada atualização — só a
                            última posição é mantida.
                        </p>
                    </Secao>

                    <Secao titulo="6. Seus direitos (LGPD)">
                        <p>
                            Você pode pedir a qualquer momento para ver, corrigir ou apagar seus dados, e
                            para encerrar sua conta. Basta escrever para{" "}
                            <a className="text-green-700 underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>.
                            Atendemos em até 15 dias. Dados que a lei obriga a manter (por exemplo, registros
                            financeiros) podem ser conservados pelo prazo legal.
                        </p>
                    </Secao>

                    <Secao titulo="7. Segurança">
                        <p>
                            A comunicação entre o app e nossos servidores é criptografada (HTTPS). Senhas são
                            guardadas embaralhadas, links de rastreio usam códigos aleatórios que não podem
                            ser adivinhados, e o acesso ao servidor é restrito à equipe.
                        </p>
                    </Secao>

                    <Secao titulo="8. Permissões do app Android">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Localização:</strong> acompanhar a entrega (só com o app em uso).</li>
                            <li><strong>Notificações:</strong> avisar sobre corridas novas.</li>
                            <li><strong>Câmera/arquivos:</strong> apenas quando você escolhe enviar uma foto.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="9. Mudanças nesta política">
                        <p>
                            Se algo mudar, atualizamos esta página e a data no topo. Mudanças relevantes
                            serão avisadas dentro do app.
                        </p>
                    </Secao>
                </article>
            </main>
        </div>
    );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="font-bold text-lg text-zinc-900 mb-2">{titulo}</h2>
            {children}
        </section>
    );
}
