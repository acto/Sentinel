/**
 * Harvest-wizard.cjs
 * Browser-based intake wizard for the Harvest-read-jira agent.
 *
 * Flow:
 *   1. Always opens in Chrome.
 *   2. Shows a splash screen (light gray background, Harvest.png centered).
 *   3. Splash navigates to /wizard where the user enters a Jira issue key.
 *   4. On submit: writes $TEMP/jira-wizard-answers.json, logs RESULT:bevestigd.
 *   5. Shows a /working spinner while the agent fetches Jira data.
 *   6. Renders /fetch-result when the agent writes $TEMP/jira-fetched.json.
 *   7. User confirms or cancels; writes $TEMP/jira-action.txt accordingly.
 *
 * Stdout signals (read by agent via get_terminal_output):
 *   RESULT:bevestigd   — user submitted a valid Jira key
 *   RESULT:cancelled   — user cancelled
 *   RESULT:analyse-started — user started analysis after Jira fetch
 *   CONFIRMED:ok       — user confirmed final summary
 */
'use strict';

const http = require('http');
const fs   = require('fs');
const cp   = require('child_process');
const path = require('path');

let mammoth = null;
let pdfParse = null;
try { mammoth = require('mammoth'); } catch (_) { mammoth = null; }
try { pdfParse = require('pdf-parse'); } catch (_) { pdfParse = null; }

const PORT         = 3133;
const TEMP         = process.env.TEMP || require('os').tmpdir();
const WORKSPACE    = path.resolve(__dirname, '..');
const SPLASH_STANDARD_PATH = path.join(WORKSPACE, 'Scripts', 'splashscreen-standard.json');
const MCP_CONFIG_PATH = path.join(WORKSPACE, '.vscode', 'mcp.json');

const SPLASH_STANDARD_DEFAULTS = {
  durationMs: 5000,
  backgroundColor: '#faf8ec',
  logoBlendMode: 'darken',
  logoBackgroundColor: 'transparent',
  cornerBlendMode: 'multiply',
  cornerBackgroundColor: '#faf8ec',
  cornerWidthPx: 112,
  cornerMaxWidthVw: 14,
  cornerOpacity: 1,
  cornerFilter: 'contrast(1.04) saturate(1.03)',
  imagesFolderName: 'Sentinel',
  mainImageCandidates: ['Harvest.png', 'harvest.png', 'Sentinel.png'],
  cornerImageCandidates: ['AI generated.jpg', 'AI generated.png', 'AI generated - dark.png']
};

function loadSplashStandard() {
  try {
    const loaded = JSON.parse(fs.readFileSync(SPLASH_STANDARD_PATH, 'utf8'));
    return Object.assign({}, SPLASH_STANDARD_DEFAULTS, loaded || {});
  } catch (_) {
    return SPLASH_STANDARD_DEFAULTS;
  }
}

const SPLASH_STANDARD = loadSplashStandard();
const JIRA_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAqcAAAGQCAMAAACkrDm+AAAA7VBMVEX///8gOFsAgv8AUswAevgAbOwAdPMAffsATssAb+4AXN8AY+QAaOgAKFEAgP8AYeMAScoAUNMAV9oom/8YM1d5puUoc9fL0dnk5+y0uMFZaIKnrLfz9fcTMFa/w8p1gJMXYtEAFkhuqP8AQ8myxu3V5PdJdtWgu+qVt+kbXM4Aef/D4/8APMiwvunD1vLw8vpIXXtVidx3uP93p++azf9jsP+PmKgogembo7FgkN0hi/93nuF4k9wojfNndY2aw/YAIEwAADyUq+M2TGyGwv8AVeIASdgqatNQgNlCpv+HsOkAM8aLouFtidmr1v/TfriLAAAbg0lEQVR4nO2de3vaRpSHwaSJ2oRE2+C78GWFDHZdCXsT1g6JlwTvYtMm3//jrASS5nZmkECSwf69f/R5ioUkwsucuZw5qtUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMfz/e604/vBguOC8MBpz/f9Su4KVIt3tcMxFGQIepMdMw+xFP6D/IqWYJs/wZX5cP924obYdvTfy5OrnkZWp3PVSA+8dCe3HeVz3iaXnHQc8hzCfU3o++qcCR9/2yFPcEJfAKzA367FsCfC9xv8a1tmzuPjOyfJKyeKIRKdHf6k7t/6I53euWtbDQ7Lvmxse8qB3q0VfgrhOPdy0hNs8c6Sy7pdUqPgjL8v+5b8RfTOhY9vC/dylbx8CU+LJvyKeREaP/g/hp42jKRWhp5Kr2jpCWewb1XtYvyJS13TduW3TBvUbVq2zbe+3lnyQW3a0/QjxGg8Fa/xwJ/qKnkZnhaOfy58O/ZX/uspw1Pvq3jOE13g70recBcV3hLc6u7OvsrjqXQal/wckqeNS/4nA09Lw+mK1lg7/NdThqediaifxppa91yjaaMxEdrTr9rjrNscngZn4nmsK6pBlT0VGlR4Whpy2G9YfOAvw9Mf8gWvyMDf2dHqJ3q63SjGU7X5zuKp0KDC09Lw5VZL0KYET70r+YLnVOB3vhquzHvqn+l9zuXplfxul5oWUDy1Jo56CnhaNF1ZB4sf8ZfgqRz2Ndp0J4ar8p4OTXeXw1NP8d16IBpUxVO+HwtPy8J7UFojPvCX4Kkc9iMfiMD/L3eYZc9nRtOXOE8D/gNYrnhgHk976qjNzuQp16DC07LwCfW4wB8M/7lMYMZabvripdWdH5nVU+KH0Wio7/B+podZ9s7UD+kNH6x4NpXzlGuebeu2Gx04vd2xXTuvpyzsp5rbPfU41VOuQYWnJRH8SOw7f0j7jSdd8thOcqhFrThl9bRzkv4cUmPtH0rDxXqd1g53NW+6E7aWFudpL+1fCxPz/vA8VDWHp1zY304/ChH4CU8b58np4GlJsNZt0kuVtf8lj/079fRsBU/TjoTd7U5SH5TAz432pYsF0xOXmz/9kXijnMS7bbjZPZ2m5zljvxFb7ZAwT5mw9jQ+HzwtiTTsh8HeT1sweoW+EE+5sO/7DzoXeU+JdfYOtx7FPFXXtZztYWZPWeM+ZbqlAjJST61hKqrVgKelEgy5NtSfmAN/IZ6ysH/mO9zV5QCbemppl6vmME/paViG0VP24V2vtp2ec0cJ/KmnrscGXonP8LQc0ghnnffCOGkO/IV4+i+v5o+0QdqRz8jaU3toTOf7wVo1uludYvQ0DfuNk4CT9lJxn3nqbHMN6vyP8LQcfEG9v93k/8jAX4SnLNRbHUFG+T3c7L1rbCinbJ1igdFGT1nYj7q07Egl8DNPA4+/9Ow4eFoKXNiPsk/Y0lTYuqoU4Wk3bYGibidbs1UUC35y02D2ji7rVFxetRumZFaTp1zYj+4+7XpaE/nCnKf8CtZ8qhWelgI3FxPN7bMxjpg0FVOAp04a9uejnnTOXw38aZ9gburlZEgrKMzzNyzXephqml+TpyyEzxb1WYafK1+V97QjN6jwtBQ6TJPILTaZSgb+AjxlYd/9EX2T3WRUNesGiOeT0lAsO1SQalancgKT7Z6TzarJUzZbO5syZalTSkPPe1o7Y5edNajwtAxYImg898gWp6jAX4Cn3TSezrcB+Fy3UG4Fh+qKrWUTg3rvgTjQbWwrShs87aTJBPESFIvoJyZPu9wc6rAGT8vBT5useEmfvUAF/tU95cJ+PCnPXlCmSSn/whuzFVOJhfnoQEs21eApC/vxAJ810nLgFzytcTk10TvhaRl03ESSeMKUjavEbOk5q3vKje/jlVK2uqNuk5K3gaQCyvNPQzqxzz4RjTZ4ysJ+PG7yJqyhF3UXPZV6qPC0BLyh0h1NZ6akbVLzP67saTraT+ehuCVKdTnJ36GTtS7lPuOUzpS2xJ0jek/ZaD/tjnKjM5OnNS4Z0IWnpUBEee4LUwP/yp4GrD+cDO/ZS9Q2Ke/WJgV05ZCuM1oQVe8p2xiVRnm2KCptk5I85RvUKTwtAafrJv+q50njyXLticC/sqfUGhPLRiU3K3d2XEpVZVnAmTZc4jiLD/1aT/mNUcl9sU6HtE1K8pSfQz2BpyXAJtmts+Rr5zb1WUrgX9lTFvZZZ5SljxJ5JBH+bUNV1dpRj+082OqB/LSS1lM22mdOBhNN4Jc99diQ3/XhafGw1SeLxfgOU0EZV6/qqfeTiPFcC05uk5ods71jSQqSe5Yd//YkTpBOOWefQuspC/tcYjTXFxC2Scmecg2qdfsAT4uGC/tc08mWpKyJrMKqntJNJ9vYotsfPb+xKEGa6addync6wxO+B8AJrfOUC/sWOyvbfSpmSyue8qv8acMMT4uC3w+9M+x64T9s0JlesSimBP5VPWVdUevkthsVNQv87i3brkduk+LveMiG9cZj/TNWwseeppLpPGU7AhrnD1M/OrHX2ZaXmtjRkqf8RsL0RPC0KPiNUZZtRzueXCG4KoF/RU/5H4YV7cybX5AP54sKqHGbUTRVymK4jLvbhZ7yZVDm93XJ7xmUtkmpngZEPQx4WhBBb8FG0nTyP2VFT9X90DL8NimPjOssYTXdIeWRRvxkXYxFnqr7oZV/CT7wq55SO7PhaUGQ2z4lbaRs6RU9VfdDqz5w20kmxF5P5jrz9KeSaRWRqrPYU3rZVfyX4CIL4WlN/QXC04Ig9kObtIlYzVOlDAoFO2/v3D1XU0nY5qTU06+2S6zxfs3enmqLqDH4bGnKUzllC54WxeKwHyIJt5qnHVN9k8QHNoqPdAgNFBP5+NmI5Ba+2lHS6VVHc7GFnnoLuyPiNinKU7VBhafFkCHsK4E/o6eNk1lViJT46/yR4YfBZUvPdbDsy/PbTtx0Bt0JW4V4YO3p7P9dd2e7k8wUcRMDC8f7altIwG2TIj3tyieBp8XgZ7BGzpbO6mljVmUn5jIWKlPY59ZDWSJVNBfhTnYm9iU3BmctL8sZiIbqjcnOictP9S+cP812Xyzwk57W5NqC8LQQAi4JWVjqsSx+RuZcGPFn9lT4hn/MvzEu7EeXsIT/Y0en+sllmy3x7GzhVSrrJx23cD3K50K2MBkV3hf3bzQROiTzW+A97UhzU/C0ELi5GPunP9yxLuPWr/Gw3WNdAvtf/p97KU/j8v0sQzp8d6931UguaE1uO6zOLjszVR6Hk4gV7jGVnxSzR0lPp/zyfO/qxJ3f2OXl5LY75P9Wk29M8FRuUOFpIbCwn8ySelFXcvblOz+4XiAv5DKeJosFPi//7AsOZp3X2dfJFchN20mzpy6baTV7yi8dkJ6ysB8PlgLWqeaGWPa20tCLnnpigwpPi4AL+4RzHe6b5wP/Mp4mYZ8baCg79gSJv8YNpdFTm5sxM3rqTjmZKE/5an9qygC3AnCywFOpyi88LQI+7Kv50Cx/WvzrMp6eqGFfXfHkkqXTv5o8tbhOp9FTV0gdpTzdpkJ7CvVXnaeecMPwtAjSjVENan8J39ryU+hLeJokRnEtJpVmykmZBP7OhMp7nlsmrEBt23TOf3QucWsT5SnVYpKfKe3o6jwV1wvgaQF4nIhK9l5N2CXV4PZHL+GpG/cbWIZ02hPg8c/UwB89DY1M5ZfsqznTEzrnX84TJDzlRvvk0034pf9FngrpKPC0APyJneBS+XH+Ofs7F/j/vkxeJD1lb2LE+dDBVzd9iagdLf6dnTvonVl8RlWUZUVW5fO2T1z5wMa2rIp3llzjMvF02LCV13iuLPb3+L57yVv+kb0esoPtf+Dp6njD7RRqjTPosr/3mBY+9SI76XRbpRvvzegpL4l02N+H0mbm3u1OIy6xfr6jPrQ0vefO9GFixweeXBGPlgy1Ty+Sdja561L3xX+oOKvfn+reEHAHD3X3CQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAWuHcfyyCx0+oDANKJPh88b4ILr58euqPAp4xwef3W4XwHqKC8nDuL4rxdOv9R/NzawFYgV9FebqFBhWUh1+Yp1vXT/1ZwPMlKKh/Ggb+/3zqzwKeL8G3okSFp6A8Chvww1NQJp3CBvzwFJRHUJCm8BSUSXEz/fAUlEhRM1PVe+oc3fVb3+sHx7tVXxlUT/CxmAa1ak+dw/qo3arX6632aLxf7bXBE1DQklTFnu4djyJJ57Sax3uVXh1UT0ENarWe7h036zwQ9flTTA+1Wk8PRU1DUW+qvDx4AoLPRYhaqae7/ZbkaesAo6nnTvClgMhfnKe7477AQAnpzo3cnNbr7cOirg/WFf/VOnl6NGrxEF3PveO26il6qM+fT6tH/gI9bS4ScPdADvsI/C+D1fP6q/T0aAxPXygriwpPQRWsKio8BZXw6dVKo/5K+6fw9AXjf1ll2F+pp3eqp+07jPdfCMHjxfJNapWe7g3UeanmADVZXgz+t6VNrdLT2pHantaRM/WS+LWsqZV6uncnN6iY5n9p/Hq8WEbVSj2tHdXFFrU1Pirq8mBTCD49bl1cvHolFTtbJ09r+4KorRZW918m3q/r60exeuSXdfK0djRuJqa2mn20piDGMe/4q9rTmnMzPm02283maf0GQ32QsGBnauWehuztDwY3RxhAbTreX1nwFxAXjFxDT8GzwPl2QfLbb799ePv2wx8fPvwR878x/5dyydHoRWeDp6AcHHWH3ps3b17NeB3ye0jo7G/vQiJxP8Ti/hnxHxz2bQ2egrIgPGWivlJFfSuIKpg6hKegLJxrIrFEEPV1VlEnHjwFZXFPJUCRov62QNTzLjwFZUGXOllG1MYQnoKy8Ogc/SVEhaegPBzNxvz8osJTUB7apc5MovLzU/AUlIh2X35eUZ+1p3u7h4OIDBusnKObu36/3/o+7vcPjm+wJasYHO2Op5yiPldPdwf99ulo1GyHjNQCQdKN3bWjzJdWqxVlErZa7ebodJzFbrAAQ47TG3lpyijq2nl6+P2U43uftuVGPEpKUg29m5f6jS9k3GG1e9duqruyZlWCpfcdixdFMlcGNCP+3KJGnpKzsU/l6b5wkG5TtFh+silsodofj0TvTJ4ejilJ44s3xXeKxa+ah/B0Mc6jvhHMI2roqWMuQrVhnu6zNOvFnh7128TGQf6tTa7VhKdLYGhQ84gaerqgnu9Gebp3p1iq93TveIGlEaOD9C7h6RKYGtQcon4IPfWMG082ydP9MRXENZ4ejdViq9S768neF3i6DIGpFcws6tv/Cj01FvLfIE8PW2T7SHs6yNCYzu9hFJ8eni6FsVuZVdTIU/NAanM8PazT5lGeOseZGtM5sajwdDkeTXplFDXy1NxB3RhPdZpSnjpE4WqjqNEZ4OlymMvvZxP1Q+SpZ3oI+qZ4uq/TlPA0V2s6O0V0G/B0SUxj/oyiztrTwFQjdUM8PeprW0jV00FOTeut8R48XR7zcyKyiDrztOZvfHsqPx/N6OlNTkvr8+etwdOl8Y01eBVRf1dEnXtqWjrdDE+JB/poPd0nqgEn12u15yhHNI/g6Qr4W8bFeZ2obxNR556aGtSN8FR5PlrkW3M0GjWbUR6KYJRaEzB+S3j8+OB4lmF13G+OxBWDMPLD0xUIvi3qpJr2SyeeBp+1PYhN8PRQaE5D4drju8HgcDfkJpRONIqoBTx7T1/M5tu76Td5VZuHYrFreJqTz8ZqkQtEjT01rEltgKf18ZgTrnlwaMrjo6J+qzmmsp/2BnV2nVZ/LLwHnubFNzapZlHfxZ46Hd05NsFTTrj+vlkf8pF/Y51zzqCeHi7pDU/zc79laFMTUV9Toiae6h/au0meNjXpqvw7x+q7TAnbu7r5Lni6DPdf9KYaWlTmaRj56RNsjqetDHUo1UFUa8GDfnVLV/B0OfzPWxcXdHFofYvKeaoTdWM8bWcpka40p636wncNyGkseLo03qfHj6/kIn7vTS3qW87TmkfOcW2Kp+3FMZ/onWbQNBQVnpaAIxRB/fWNF1VpUXlPaz7Vom6Ip9keOLEvN6fNLE/9IUM/PC2UYJ5johP1d95TMvRviKfNLA+cUPJPmtk24+0eEM9fg6dFEnuqE1X0tOZ9VEb9m+Fptk3WuwfSU38OMm7NPlQnXeHpt48q3yj+W2GH8dCdnSzxVNNHlTytBdfyUGwzPM32mKlD2bXMj1NRIz88vRCe7pS0gVK/Mlqh/2OeS8IXjHLTSnzu5XlUgD/1VBQ1Tp9SPI06qReb52l7USmJGY60ZJqj0sW+nEAAT2tS6FUqnKT5eSydhKzBa594vKekqK8VT+VVg43wtJXpIahK2M9R8uQYnsrI2+qWFvXPW8FTSlTK05rDrxpsgqe6w+R3jTPcgAYlLQCeEp4uKWrYoPKeEqKSnob89ZisGmyCp+bKPClSGv8oz5OolbkpeKokLS8talTVXNj7pIiq8zTEu3+cPf9nEzzNZJw0yd/KsjDAkCf74am64XlZUc97kqeKqAZP53h/eUV9rhLz+jKN24/E7mnOeoHySAqeEtuUlxRVaU8VURd6WiCledq6W6Z7mmkpirF3B08l6KfuLCEq4akk6rPwtJ3N0xuxhznOWeBU6qDC0xpVOmopUSlP2Zmi87x6Fp5mmj2VNpxknCNgSLtU4Sn92J1lRCU9FUR9QZ5Kw6iMcnN3Nsb+KAlyU90SotKe8qK+IE93pX14eetBSwMpeErMTC0pauQpVYyPifosPM2mnLQaNcq8th+zh/2mMvrnmOlEfUuKqn0qZHqmN8/C00wjd6k9zDuMgqcEmiK8C0T9IIsaeurQtaPiM71+QZ6K01Kt/J4ewFMZXYWznKJGnmrKpMZnerme5luNikA9FJXrQkR919XXnZ6f6SV5Kl79LvfTq+CpSkDLlVPU826NHPCzM21dV/eZntjTgbQ2AE+LQFvjOY+oM0+vdaWjojO9JE/F6VN4Wgza2rk5RI08NVQ1h6e5gKck2vL72UWdeWoojw5P8wBPabR+GUT9IIg681QzMxUDTzMDT2n0DWHWFvXdbM9pYKiO/gWeZgaeatDX4M0m6p+//8/sNPoivGhPcwBPtTwuFvW1XtTY05qn1/QleYp5qfL4pHtQhEbUd7yoiaemHurL8VTMH4WnxeLpYr8qqpw89eGP2FP9XP9L8lRaN82bJg1PF/Bpa1H2lFbUxFPDg6ZerKfIQyma4Joua75Y1NRTXTbKS/J0f1VPkde3kE8fLwhVF4qaeqovv/9yPF01T3oX7WkGnE8fty4uLkInhRpp/OyUIuofzNNaoJk6eDmeHkn7RvJti8a+k+w4f93f318L9SaNonLtqVbUl+Opso8vp2c3eH7U0jgXbwyiCp5qRH25nuYrh6IU7oGnOQgu3hhEFT2tOVQf9Qk9HVAHleepNNGfe2IKdSaWJ7jYMogqeRpVrlIGY0/o6Q11UImeytWk83kqF0+FpzmINpUYRJU9JervV+epXM25WbWn8kAo3wZ++clT8DQHs81P+pyU17Kn6qpBdZ7uyQ9qrtrT3ZXq9cl3D09zMN+kpxWV8FQua16dp3LgHJNP0inRU6XUbp7AL989PM1DvJlUJyrpqbhqUKGnYuBs9Um7SvRULtiXawZVqoIGT3ORbHqmRX33ivY0fN/9x9miwfsKPRUN1ClYpqf78i8le4OqPr8XnuYg3ZxPi6r1NML7dX39+PG+qluVHy2qSawr01M5drezL50qzSk8zQPvKSGq0dOK2ZX6d5r1oDI9VZ4flTkHVemdwtNcsGInpKhr5KnypGZ6+rRUT5UZ1MxPPCEexAtPc8AV5SFE1fdPq+dIapBaY9qRUj1VHnSWMblPjfrwNBd88ShV1DVqT3fl5y7qnv1QqqfyE6QyzqEST+GFp7kQipypoq6Np3vyA8W16Urleqo+VS9D1hSpKTzNg1iMTxF1XTzdO5A1rdfJWf6yPVV6yaFui95DawpP8yBVNZdErTLuO/v65fL9sTIM0WYrleupskq/uEW9qZOawtM8EE8x40Wt0tOb03b/hurtHfVH6jfdJJP6aqV7qjao9aZpdoqKBPA0N45cNFIUdatKT5v1VnPUPhjsc1+7s39cJyzVjvZL95RoUOvtujYUDFpMa6zvr4Cyj1QQtWJPZ99muzk6HdX7EePTUVOdeJx9ydpgW7anRIManmBMSRceyl2mdYd9J8ujFvLnRP39CTxNvtUZpKN1U3NauqfqkH92nWb7YF/wbncwHol1JXZRZ2J5iJp+3G7pp/PUjGHsUrqnSiJpTLt5Wu8fDyKOD+qjUVtK3z924OnyOMTjodhTzNbU01ZfnwBSvqdq6hO7XHuO2uK2xnuo27MKVFXzRNR19VQ3dxpRvqfyRv5MNI9QX2olHKqYb/IUsy+fqruP7J62jw3fcAWe1m70PWcNo6ijAk9XgK4ZGYu6lp4a5ysr8ZTMKzHe8iwNAJ6uAv2kqbmo6+hp07xvvhJPHSXdwEi7P/tlwdNVMDzAdB3j/gJNq/FU3dJnvOW5pvB0NTSP7otEXT9PzUG/VpWnefqoo2QSDZ6uxi9tHd9187RF1+rhqcrT2qGaHEPe8ihdVIWnq0HWjZqJul6etpoZNnhW5mlt7665uEltchn/8HRFdA+aqnQcdfidmB4XGib9YilHdZ5GTeqC31ZbWDiDp6uiKb//vkJPZyvip02Nq+3movFTQpWe1vYGLX2b2mpKew7g6cpoyu9X6mltlsbXb0dJUu12K6YdKnrautvP+qUefj/l+K7pKdyIRy3MyTdcbyyv5MeSno7lbL9j8aL5yqiBGfTkVNWeznB29weDu37MweDmaL2/0L1Bvxn9tGYTAPNf1qh9QKZ8g5UhRX0STzeRvcPBQb9fP22P+/07IdMbFAz15D54CtYOf0sRFZ6C9SNQikXDU7COyMWi4SlYS4LPFxfwFKw/AV/WHJ6C9eXX49bFxfv38BSsO/7948dXYRcAnoINIAie+g4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgKf4fDfLsSa6v958AAAAASUVORK5CYII=';
const answersPath  = path.join(TEMP, 'jira-wizard-answers.json');
const actionPath   = path.join(TEMP, 'jira-action.txt');
const summaryPath  = path.join(TEMP, 'jira-summary.md');
const summaryConfirmedPath = path.join(TEMP, 'jira-summary-confirmed.json');
const warningPath  = path.join(TEMP, 'jira-existing-warning.json');
const fetchedPath      = path.join(TEMP, 'jira-fetched.json');
const fetchErrorPath   = path.join(TEMP, 'jira-fetch-error.json');
const dorCheckPath = path.join(TEMP, 'jira-dor-check.json');
const testabilityCheckPath = path.join(TEMP, 'jira-testability-check.json');
const dorDodInstructionsPath = path.join(WORKSPACE, 'Instructions', '01-Harvest-DoR-DoD.instructions.md');
const testIstqbInstructionsPath = path.join(WORKSPACE, 'Instructions', '01-Harvest-test-istqb.instructions.md');
const redirectHtml = path.join(TEMP, 'Harvest-wizard-redirect.html');
const chromeProfileDir = path.join(TEMP, 'SentinelChrome', 'Harvest');

// IMPORTANT: each terminal/shell session on this machine may resolve process.env.TEMP
// to a different session-specific subfolder (e.g. Temp\2, Temp\7, ...). The agent MUST
// write all state files (jira-summary.md, jira-fetched.json, jira-dor-check.json,
// jira-testability-check.json, jira-wizard-answers.json) to THIS exact path — never
// assume TEMP resolved in another terminal is the same directory.
console.log('TEMP=' + TEMP);

// Route all crash output to stdout so the agent can detect it.
process.on('uncaughtException', function(e) {
  console.log('CRASH:', e && (e.stack || e.message));
  process.exit(1);
});

// Kill any stale process holding the port.
try {
  cp.execSync(
    'for /f "tokens=5" %a in (\'netstat -ano ^| findstr " :' + PORT + ' "\') do taskkill /f /pid %a',
    { shell: 'cmd.exe', stdio: 'ignore' }
  );
} catch (_) {}

// ---------------------------------------------------------------------------
// Splash image — prefer Pictures\Sentinel\Harvest.png, fallback to first image in folder
// ---------------------------------------------------------------------------
const splashImagesDir = path.join(process.env.USERPROFILE || '', 'Pictures', SPLASH_STANDARD.imagesFolderName);
const splashImageCandidates = SPLASH_STANDARD.mainImageCandidates;
const splashCornerImageCandidates = SPLASH_STANDARD.cornerImageCandidates;

function buildDataUrlFromFile(filePath) {
  if (!filePath) {
    return '';
  }

  try {
    const imgBuf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : ext === '.gif' ? 'image/gif'
      : 'image/png';
    return 'data:' + mime + ';base64,' + imgBuf.toString('base64');
  } catch (_) {
    return '';
  }
}

function resolveSplashImagePath() {
  for (const name of splashImageCandidates) {
    const candidatePath = path.join(splashImagesDir, name);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  try {
    const files = fs.readdirSync(splashImagesDir);
    const firstImage = files.find(function(fileName) {
      return /\.(png|jpe?g|webp|gif)$/i.test(fileName);
    });
    if (firstImage) {
      return path.join(splashImagesDir, firstImage);
    }
  } catch (_) {}

  return '';
}

const splashImgPath = resolveSplashImagePath();
const splashImgSrc = buildDataUrlFromFile(splashImgPath);

function resolveSplashCornerImagePath() {
  for (const name of splashCornerImageCandidates) {
    const candidatePath = path.join(splashImagesDir, name);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return '';
}

const splashCornerImgPath = resolveSplashCornerImagePath();
const splashCornerImgSrc = buildDataUrlFromFile(splashCornerImgPath);

// Acto logo (used in summary page header)
// ---------------------------------------------------------------------------
const LOGO = 'data:image/png;base64,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';

// ---------------------------------------------------------------------------
// Open Chrome (always Chrome, never the default browser)
// ---------------------------------------------------------------------------
function openChrome(url) {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];

  // Close only prior Harvest wizard browser sessions (profile-isolated),
  // so a new run starts with one clear window.
  try {
    const ps = "$p='" + chromeProfileDir.replace(/'/g, "''") + "';"
      + "Get-CimInstance Win32_Process -Filter \"name = 'chrome.exe'\" | "
      + "Where-Object { $_.CommandLine -and $_.CommandLine.Contains($p) } | "
      + "ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }";
    cp.spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
  } catch (_) {}
  // Reset the dedicated profile between runs to avoid Chrome session-restore warnings.
  try { fs.rmSync(chromeProfileDir, { recursive: true, force: true }); } catch (_) {}
  try { fs.mkdirSync(chromeProfileDir, { recursive: true }); } catch (_) {}

  // Write a tiny redirect page so Chrome opens the local server URL.
  const redirectContent = '<!DOCTYPE html><html><head>'
    + '<meta http-equiv="refresh" content="0; url=' + url + '">'
    + '</head><body></body></html>';
  fs.writeFileSync(redirectHtml, redirectContent, 'utf8');

  const fileUrl = 'file:///' + redirectHtml.replace(/\\/g, '/');

  let launched = false;
  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      cp.exec('"' + chromePath + '" --user-data-dir="' + chromeProfileDir + '" --new-window --start-maximized --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble "' + fileUrl + '"');
      launched = true;
      break;
    }
  }
  if (!launched) {
    // Last-resort fallback: rely on `chrome` being in PATH.
    cp.exec('start "" /max chrome --user-data-dir="' + chromeProfileDir + '" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble "' + fileUrl + '"');
  }

  // Bring the Chrome window to front after it has had time to open.
  setTimeout(function() {
    cp.exec(
      'powershell -NoProfile -NonInteractive -Command "'
      + 'Add-Type -AssemblyName Microsoft.VisualBasic;'
      + 'try{[Microsoft.VisualBasic.Interaction]::AppActivate(\'chrome\')}catch{}"'
    );
  }, 2000);
}

// ---------------------------------------------------------------------------
// Shared CSS
// ---------------------------------------------------------------------------
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#ebebeb;color:#1a1a1a;min-height:100vh}

/* Card / form */
.card{background:#fff;border:1px solid #dde;border-radius:12px;padding:32px 40px;
  width:100%;max-width:520px;margin-top:40px}
.page-title{font-size:.8rem;font-weight:700;color:#0052cc;text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:8px}
h1{font-size:1.3rem;color:#1a1a1a;margin-bottom:24px;font-weight:600}
label{display:block;font-size:.82rem;font-weight:600;color:#555;
  text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
input[type=text]{width:100%;padding:10px 14px;font-size:1rem;border:2px solid #dde;
  border-radius:8px;font-family:inherit;outline:none;transition:border-color .15s;
  text-transform:uppercase;letter-spacing:.05em}
input[type=text]:focus{border-color:#0052cc}
.hint{font-size:.82rem;color:#888;margin-top:6px}
.error{font-size:.82rem;color:#c0392b;margin-top:8px;display:none}
.actions{display:flex;gap:12px;margin-top:28px;align-items:center}
.btn{padding:10px 24px;background:#0052cc;color:#fff;border:none;border-radius:8px;
  font-family:inherit;font-size:.95rem;font-weight:600;cursor:pointer;transition:background .15s}
.btn:hover{background:#0041a8}
.btn:disabled{background:#aac;cursor:not-allowed}
.btn-cancel{background:#c8c8c8;color:#333}
.btn-cancel:hover{background:#b0b0b0}
/* Center wrapper for wizard pages */
.page-wrap{display:flex;flex-direction:column;align-items:center;padding:24px}

/* Working / summary pages */
.working{display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:60vh;gap:16px;text-align:center}
.working h2{color:#0052cc;font-size:1.2rem}
.working p{color:#666;font-size:.9rem}
.summary-wrap{max-width:800px;width:100%;margin:32px auto;padding:0 24px 100px}
.summary-wrap h1{font-size:1.4rem;color:#0052cc;margin:24px 0 8px}
.summary-wrap h2{font-size:1rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.05em;color:#555;margin:20px 0 6px;padding-bottom:4px;
  border-bottom:1px solid #eee}
.summary-wrap p{line-height:1.7;margin-bottom:8px;white-space:pre-wrap}
.summary-wrap ul{padding-left:20px;margin-bottom:8px}
.summary-wrap li{line-height:1.7}
.summary-footer{position:fixed;bottom:0;left:0;right:0;background:#ebebeb;
  border-top:1px solid #dde;padding:12px 24px;display:flex;gap:12px;justify-content:center}

/* Splash */
.splash{position:fixed;inset:0;background:${SPLASH_STANDARD.backgroundColor};display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:24px;isolation:isolate}
.splash-logo{position:absolute;top:16px;left:24px;height:48px;width:auto;
  mix-blend-mode:${SPLASH_STANDARD.logoBlendMode};background:${SPLASH_STANDARD.logoBackgroundColor};border-radius:0;padding:0}
.splash-img{max-width:360px;max-height:360px;width:auto;height:auto;
  object-fit:contain;border-radius:12px}
.splash-corner{position:absolute;right:24px;bottom:18px;display:flex;align-items:flex-end}
.splash-corner-img{width:${SPLASH_STANDARD.cornerWidthPx}px;max-width:${SPLASH_STANDARD.cornerMaxWidthVw}vw;height:auto;object-fit:contain;
  mix-blend-mode:${SPLASH_STANDARD.cornerBlendMode};background:${SPLASH_STANDARD.cornerBackgroundColor};border-radius:0;padding:0;opacity:${SPLASH_STANDARD.cornerOpacity};filter:${SPLASH_STANDARD.cornerFilter}}
.splash-placeholder{width:180px;height:180px;background:#dde;border-radius:50%;
  display:flex;align-items:center;justify-content:center;color:#aaa;font-size:.9rem}
.splash-footer{display:flex;flex-direction:column;align-items:center;gap:10px}
.splash-title{font-size:1.1rem;font-weight:600;color:#0052cc}
.splash-sub{font-size:.88rem;color:#999}
.spinner{width:36px;height:36px;border:4px solid #dde;border-top-color:#0052cc;
  border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`;

// ---------------------------------------------------------------------------
// Minimal markdown → HTML
// ---------------------------------------------------------------------------
function mdToHtml(md) {
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    return s;
  }
  const lines = md.split('\n');
  let out = '', inUl = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { if (inUl) { out += '</ul>\n'; inUl = false; } continue; }
    if (/^#{1,2} /.test(t)) {
      if (inUl) { out += '</ul>\n'; inUl = false; }
      const m = t.match(/^(#{1,2}) (.+)$/);
      out += '<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>\n';
      continue;
    }
    if (/^[-*] /.test(t)) {
      if (!inUl) { out += '<ul>\n'; inUl = true; }
      out += '<li>' + inline(t.slice(2)) + '</li>\n';
      continue;
    }
    if (inUl) { out += '</ul>\n'; inUl = false; }
    out += '<p>' + inline(t) + '</p>\n';
  }
  if (inUl) out += '</ul>\n';
  return out;
}



// ---------------------------------------------------------------------------

// Summary page CSS -- matches wizard-serve.cjs visual style

// ---------------------------------------------------------------------------

const SUMMARY_CSS = `

*{box-sizing:border-box}

body{font-family:Segoe UI,sans-serif;max-width:860px;margin:0 auto;padding:0 24px 100px;color:#1a1a1a;background:#ebebeb;overflow-y:auto}

h2{font-size:.9rem;color:#555;margin-top:28px;text-transform:uppercase;letter-spacing:.06em}

.top-header{display:flex;align-items:center;padding:16px 0 12px;margin-bottom:28px;border-bottom:2px solid #0052cc;position:sticky;top:0;background:#ebebeb;z-index:50}

.issue-header{display:flex;flex-direction:column;gap:4px}

.issue-title{font-size:1.3rem;color:#0052cc;margin:0;font-weight:600}

.logo{height:auto;max-height:80px;width:auto;margin-right:16px;flex-shrink:0}

.badge{display:inline-block;background:#e3efff;color:#0052cc;border-radius:4px;padding:2px 10px;font-size:.85rem;font-weight:600;margin-bottom:4px;align-self:flex-start}

.h-item{display:flex;align-items:baseline;gap:10px;padding:8px 14px;background:#fff;border:1px solid #dde;border-radius:6px;margin-bottom:6px}

.h-label{font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#888;min-width:160px}

.h-value{font-weight:600;color:#0052cc}

p{line-height:1.65;margin-bottom:8px}

ul{padding-left:20px;margin-bottom:8px}

li{line-height:1.7}

.empty{color:#999;font-style:italic}

details.collapsible-section{margin:16px 0;border:1px solid #dde;border-radius:8px;background:#fff;padding:0}

details.collapsible-section summary{cursor:pointer;padding:12px 16px;user-select:none;list-style:none;display:flex;align-items:center;font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#555}

details.collapsible-section summary::-webkit-details-marker{display:none}

details.collapsible-section summary::before{content:"▶";font-size:.8rem;margin-right:10px;color:#0052cc;transition:transform .2s}

details.collapsible-section[open] summary::before{transform:rotate(90deg)}

details.collapsible-section .section-body{padding:0 16px 16px}

.actions{position:fixed;bottom:0;left:0;right:0;background:#ebebeb;border-top:1px solid #dde;padding:12px 24px;display:flex;gap:12px;justify-content:center}

.btn{padding:10px 22px;background:#0052cc;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:600}

.btn:hover{background:#0041a8}

.btn:disabled{background:#aac;cursor:not-allowed}

.btn-cancel{background:#c8c8c8;color:#333}

.btn-cancel:hover{background:#b0b0b0}

`;

// ---------------------------------------------------------------------------

// HTML escape helper (for summary page)

// ---------------------------------------------------------------------------

function escHtml(s) {

  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

}



// ---------------------------------------------------------------------------

// Rich markdown -> HTML for the summary page (sections, h-items, collapsible)

// ---------------------------------------------------------------------------

function mdToHtmlSummary(md) {

  function inline(s) {

    s = escHtml(s);

    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    return s;

  }



  // Parse into sections by ## headings (h1 is shown in the page header)

  var sections = [];

  var cur = null;

  md.split('\n').forEach(function(raw) {

    var t = raw.trim();

    if (/^# /.test(t)) return;

    if (/^## /.test(t)) {

      if (cur) sections.push(cur);

      cur = { heading: t.replace(/^## /, '').trim(), lines: [] };

      return;

    }

    if (cur) { cur.lines.push(raw); }

    else if (t) {

      if (!sections.length || sections[sections.length - 1].heading !== null) {

        sections.push({ heading: null, lines: [] });

      }

      sections[sections.length - 1].lines.push(raw);

    }

  });

  if (cur) sections.push(cur);



  function renderLines(lines) {

    var out = '', inUl = false;

    lines.forEach(function(raw) {

      var t = raw.trim();

      if (!t) { if (inUl) { out += '</ul>\n'; inUl = false; } return; }

      var dotBullet = raw.match(/^\s*•\s+(.+)$/);
      if (dotBullet) {
        if (inUl) { out += '</ul>\n'; inUl = false; }
        out += '<p style="margin-left:18px">• ' + inline(dotBullet[1]) + '</p>\n';
        return;
      }

      if (/^[-*] /.test(t)) {

        if (!inUl) { out += '<ul>\n'; inUl = true; }

        out += '<li>' + inline(t.slice(2)) + '</li>\n';

        return;

      }

      if (inUl) { out += '</ul>\n'; inUl = false; }

      out += '<p>' + inline(t) + '</p>\n';

    });

    if (inUl) out += '</ul>\n';

    return out;

  }



  function renderStatusLines(lines) {

    // "**Key:** Value | **Key2:** Value2" -> .h-item rows

    var content = lines.map(function(l) { return l.trim(); }).filter(Boolean).join(' ');

    var parts = content.split(/\s*\|\s*/);

    var out = '';

    parts.forEach(function(part) {

      var m = part.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);

      if (m) {

        out += '<div class="h-item"><span class="h-label">' + escHtml(m[1]) + '</span>'

             + '<span class="h-value">' + escHtml(m[2].trim()) + '</span></div>\n';

      } else if (part.trim()) {

        out += '<p>' + inline(part) + '</p>\n';

      }

    });

    return out || '<span class="empty">Geen statusinfo.</span>';

  }



  var html = '';

  sections.forEach(function(sec) {

    if (sec.heading === null) {

      html += renderLines(sec.lines);

    } else if (/^status$/i.test(sec.heading)) {

      html += '<div style="margin:16px 0">' + renderStatusLines(sec.lines) + '</div>\n';

    } else {

      var isOpen = !/gerelateerde/i.test(sec.heading);
      html += '<details class="collapsible-section"' + (isOpen ? ' open' : '') + '>\n'

            + '<summary>' + escHtml(sec.heading) + '</summary>\n'

            + '<div class="section-body">' + renderLines(sec.lines) + '</div>\n'

            + '</details>\n';

    }

  });

  return html || '<span class="empty">Geen inhoud gevonden.</span>';

}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Request body reader
// ---------------------------------------------------------------------------
function readBody(req) {
  return new Promise(function(resolve) {
    let data = '';
    req.on('data', function(chunk) { data += chunk; });
    req.on('end', function() { resolve(data); });
  });
}

function parseForm(body) {
  const params = {};
  for (const pair of body.split('&')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = decodeURIComponent(pair.slice(0, idx));
    const v = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    params[k] = v;
  }
  return params;
}

function writeFetchError(code, message, details) {
  const payload = {
    code: code,
    message: message,
    details: details || '',
    at: new Date().toISOString()
  };
  try { fs.writeFileSync(fetchErrorPath, JSON.stringify(payload, null, 2), 'utf8'); } catch (_) {}
}

function getLocalTimestampParts(d) {
  const dt = d instanceof Date ? d : new Date();
  const pad = function(n) { return String(n).padStart(2, '0'); };
  return {
    year: String(dt.getFullYear()),
    month: pad(dt.getMonth() + 1),
    day: pad(dt.getDate()),
    hour: pad(dt.getHours()),
    minute: pad(dt.getMinutes()),
    second: pad(dt.getSeconds())
  };
}

function buildSummaryTimestampForFile(d) {
  const p = getLocalTimestampParts(d);
  return p.year + p.month + p.day + '-' + p.hour + p.minute + p.second;
}

function buildSummaryTimestampForDisplay(d) {
  const p = getLocalTimestampParts(d);
  return p.day + '-' + p.month + '-' + p.year + ' ' + p.hour + ':' + p.minute + ':' + p.second;
}

function parseMcpToolResult(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
  if (!Array.isArray(result.content)) return result;

  const textParts = result.content
    .filter(function(part) { return part && part.type === 'text' && typeof part.text === 'string'; })
    .map(function(part) { return part.text; });

  if (!textParts.length) return result;
  const joined = textParts.join('\n').trim();
  if (!joined) return result;

  try {
    return JSON.parse(joined);
  } catch (_) {
    return { text: joined };
  }
}

function loadMcpServerLaunchConfig() {
  const fallback = {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['-y', 'mcp-atlassian'],
    env: {}
  };

  try {
    const raw = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const server = parsed && parsed.servers && parsed.servers['mcp-atlassian'];
    if (!server || !server.command) return fallback;

    const args = Array.isArray(server.args)
      ? server.args.map(function(a) { return String(a); })
      : [];
    const env = server.env && typeof server.env === 'object' ? server.env : {};

    return {
      command: String(server.command),
      args: args,
      env: env
    };
  } catch (_) {
    return fallback;
  }
}

function getMcpConfigHealth() {
  const required = ['ATLASSIAN_BASE_URL', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN'];
  const launch = loadMcpServerLaunchConfig();
  const mergedEnv = buildMcpEnv(launch.env);

  const unresolvedInputs = required.filter(function(k) {
    const raw = String((launch.env && launch.env[k]) || '').trim();
    return /^\$\{input:[^}]+\}$/.test(raw);
  });

  const missingValues = required.filter(function(k) {
    const v = String(mergedEnv[k] || '').trim();
    return !v || /^\$\{input:[^}]+\}$/.test(v);
  });

  return {
    launch: launch,
    unresolvedInputs: unresolvedInputs,
    missingValues: missingValues,
    isHealthy: missingValues.length === 0
  };
}

function resolveTemplateEnvValue(value) {
  const asString = String(value == null ? '' : value);
  const m = asString.match(/^\$\{input:([^}]+)\}$/);
  if (!m) return asString;

  const key = m[1].toLowerCase();
  if (key.indexOf('baseurl') !== -1) return readEffectiveEnvValue('ATLASSIAN_BASE_URL');
  if (key.indexOf('email') !== -1) return readEffectiveEnvValue('ATLASSIAN_EMAIL');
  if (key.indexOf('token') !== -1) return readEffectiveEnvValue('ATLASSIAN_API_TOKEN');
  return '';
}

const _winUserEnvCache = Object.create(null);
function readWindowsUserEnvVar(name) {
  if (process.platform !== 'win32') return '';
  if (Object.prototype.hasOwnProperty.call(_winUserEnvCache, name)) {
    return _winUserEnvCache[name];
  }

  try {
    const ps = '$v=[Environment]::GetEnvironmentVariable(\'' + String(name).replace(/'/g, "''") + '\',\'User\'); if($v){$v}';
    const out = cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });
    const value = String(out || '').trim();
    _winUserEnvCache[name] = value;
    return value;
  } catch (_) {
    _winUserEnvCache[name] = '';
    return '';
  }
}

function readEffectiveEnvValue(name) {
  const fromProcess = String(process.env[name] || '').trim();
  if (fromProcess) return fromProcess;
  return readWindowsUserEnvVar(name);
}

function buildMcpEnv(serverEnv) {
  const merged = Object.assign({}, process.env);
  const envObj = serverEnv && typeof serverEnv === 'object' ? serverEnv : {};
  for (const [k, v] of Object.entries(envObj)) {
    merged[k] = resolveTemplateEnvValue(v);
  }
  return merged;
}

function quoteCmdArg(arg) {
  const s = String(arg == null ? '' : arg);
  if (!s.length) return '""';
  if (!/[\s"]/g.test(s)) return s;
  // cmd.exe expects embedded quotes to be doubled, not backslash-escaped.
  return '"' + s.replace(/"/g, '""') + '"';
}

function createMcpClient(launch) {
  const chosen = launch || loadMcpServerLaunchConfig();
  const env = chosen.mergedEnv || buildMcpEnv(chosen.env);

  let child;
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(String(chosen.command || ''))) {
    const cmdline = quoteCmdArg(chosen.command) + (Array.isArray(chosen.args) && chosen.args.length
      ? ' ' + chosen.args.map(quoteCmdArg).join(' ')
      : '');
    // Node on this Windows runtime throws EINVAL for direct .cmd spawn.
    // Run through cmd.exe while keeping stdio pipes attached to the child process.
    const comspec = process.env.ComSpec || 'cmd.exe';
    child = cp.spawn(comspec, ['/d', '/s', '/c', cmdline], {
      env: env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false
    });
  } else {
    child = cp.spawn(chosen.command, chosen.args, {
      env: env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false
    });
  }

  let nextId = 1;
  const pending = new Map();
  let stdoutBuf = Buffer.alloc(0);
  let stderrBuf = '';

  function settleAll(err) {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
  }

  function parseFrames() {
    while (true) {
      let headerEnd = stdoutBuf.indexOf('\r\n\r\n');
      let headerSepLen = 4;
      if (headerEnd === -1) {
        headerEnd = stdoutBuf.indexOf('\n\n');
        headerSepLen = 2;
      }
      if (headerEnd === -1) return;

      const headerText = stdoutBuf.slice(0, headerEnd).toString('utf8');
      const lenMatch = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) {
        stdoutBuf = stdoutBuf.slice(headerEnd + headerSepLen);
        continue;
      }

      const len = Number(lenMatch[1]);
      const frameStart = headerEnd + headerSepLen;
      const frameEnd = frameStart + len;
      if (stdoutBuf.length < frameEnd) return;

      const jsonStr = stdoutBuf.slice(frameStart, frameEnd).toString('utf8');
      stdoutBuf = stdoutBuf.slice(frameEnd);

      let msg;
      try { msg = JSON.parse(jsonStr); } catch (_) { continue; }
      if (!Object.prototype.hasOwnProperty.call(msg, 'id')) continue;

      const p = pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      clearTimeout(p.timer);

      if (msg.error) p.reject(new Error(String(msg.error.message || 'MCP error')));
      else p.resolve(msg.result);
    }
  }

  child.stdout.on('data', function(chunk) {
    stdoutBuf = Buffer.concat([stdoutBuf, chunk]);
    parseFrames();
  });

  child.stderr.on('data', function(chunk) {
    stderrBuf += String(chunk);
  });

  child.on('error', function(err) {
    settleAll(err);
  });

  child.on('exit', function(code) {
    if (pending.size > 0) {
      const msg = 'MCP process exited with code ' + String(code) + (stderrBuf ? (': ' + stderrBuf.trim()) : '');
      settleAll(new Error(msg));
    }
  });

  function sendMessage(obj) {
    const payload = Buffer.from(JSON.stringify(obj), 'utf8');
    const header = Buffer.from('Content-Length: ' + payload.length + '\r\n\r\n', 'utf8');
    child.stdin.write(Buffer.concat([header, payload]));
  }

  function request(method, params, timeoutMs) {
    return new Promise(function(resolve, reject) {
      const id = nextId++;
      const timer = setTimeout(function() {
        pending.delete(id);
        reject(new Error('MCP timeout on ' + method));
      }, timeoutMs || 30000);

      pending.set(id, { resolve: resolve, reject: reject, timer: timer });
      sendMessage({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
    });
  }

  function notify(method, params) {
    sendMessage({ jsonrpc: '2.0', method: method, params: params || {} });
  }

  function close() {
    try { child.stdin.end(); } catch (_) {}
    try { child.kill(); } catch (_) {}
  }

  return {
    request: request,
    notify: notify,
    close: close
  };
}

async function fetchJiraViaMcp(jiraKey) {
  const health = getMcpConfigHealth();
  const launch = health.launch;
  launch.mergedEnv = buildMcpEnv(launch.env);

  if (health.missingValues.length) {
    const details = health.unresolvedInputs.length
      ? 'In .vscode/mcp.json staan nog ${input:...} placeholders voor: ' + health.unresolvedInputs.join(', ') + '. Vul hier concrete waarden in voor deze wizard-run.'
      : 'Vul de waarden direct in .vscode/mcp.json onder servers.mcp-atlassian.env voor: ' + health.missingValues.join(', ');
    writeFetchError(
      'missing-env',
      'MCP credentials ontbreken in de configuratie.',
      details
    );
    return;
  }

  let client = null;
  try {
    client = createMcpClient(launch);
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'sentinel-harvest-wizard', version: '0.2.16' }
    }, 90000);
    client.notify('notifications/initialized', {});

    const rootRaw = await client.request('tools/call', {
      name: 'read_jira_issue',
      arguments: { issueKey: jiraKey }
    }, 90000);
    const rootParsed = parseMcpToolResult(rootRaw);
    const rootIssue = rootParsed && rootParsed.issue ? rootParsed.issue : rootParsed;
    const childIssueKeys = extractChildIssueKeys(rootIssue);
    const childIssues = [];
    const childIssueErrors = [];

    for (const childKey of childIssueKeys) {
      try {
        const childRaw = await client.request('tools/call', {
          name: 'read_jira_issue',
          arguments: { issueKey: childKey }
        }, 90000);
        const childParsed = parseMcpToolResult(childRaw);
        const childIssue = childParsed && childParsed.issue ? childParsed.issue : childParsed;
        if (childIssue && typeof childIssue === 'object') {
          childIssues.push(childIssue);
        }
      } catch (childErr) {
        childIssueErrors.push({
          issueKey: childKey,
          error: childErr && (childErr.message || String(childErr)) || 'Onbekende fout'
        });
      }
    }

    const normalized = {
      jiraKey: jiraKey,
      fetchedAt: new Date().toISOString(),
      rootIssue: rootIssue,
      childIssueKeys: childIssueKeys,
      childIssues: childIssues
    };
    if (childIssueErrors.length) normalized.childIssueErrors = childIssueErrors;

    fs.writeFileSync(fetchedPath, JSON.stringify(normalized, null, 2), 'utf8');
    try { if (fs.existsSync(fetchErrorPath)) fs.unlinkSync(fetchErrorPath); } catch (_) {}
  } catch (e) {
    var details = e && (e.message || String(e)) || 'Onbekende fout';
    try {
      const rootIssue = await fetchJiraViaRest(jiraKey, launch.mergedEnv);
      const childFetch = await fetchChildIssuesViaRest(rootIssue, launch.mergedEnv);
      const normalizedFallback = {
        jiraKey: jiraKey,
        fetchedAt: new Date().toISOString(),
        source: 'rest-fallback',
        rootIssue: rootIssue,
        childIssueKeys: childFetch.childIssueKeys,
        childIssues: childFetch.childIssues
      };
      if (childFetch.childIssueErrors.length) normalizedFallback.childIssueErrors = childFetch.childIssueErrors;
      fs.writeFileSync(fetchedPath, JSON.stringify(normalizedFallback, null, 2), 'utf8');
      try { if (fs.existsSync(fetchErrorPath)) fs.unlinkSync(fetchErrorPath); } catch (_) {}
      return;
    } catch (restErr) {
      var restDetails = restErr && (restErr.message || String(restErr)) || 'Onbekende REST-fout';
      if (/ENOENT/i.test(details)) {
        details += ' (MCP command niet gevonden. Controleer command en args in .vscode/mcp.json.)';
      }
      if (/EINVAL/i.test(details)) {
        details += ' (Windows spawn-fout. Gebruik een geldig command in .vscode/mcp.json; voor npx op Windows: C:\\Program Files\\nodejs\\npx.cmd.)';
      }
      writeFetchError('mcp-fetch-failed', 'Jira ophalen via MCP is mislukt.', details + ' | REST fallback: ' + restDetails);
    }
  } finally {
    if (client) client.close();
  }
}

function extractChildIssueKeys(issue) {
  if (!issue || typeof issue !== 'object') return [];
  const fields = issue.fields && typeof issue.fields === 'object' ? issue.fields : {};
  const subtasks = Array.isArray(fields.subtasks) ? fields.subtasks : [];
  const keys = [];
  for (const subtask of subtasks) {
    if (!subtask || typeof subtask !== 'object') continue;
    const k = String(subtask.key || subtask.issueKey || subtask.id || '').trim();
    if (k) keys.push(k);
  }
  return Array.from(new Set(keys));
}

async function fetchChildIssuesViaRest(rootIssue, mergedEnv) {
  const childIssueKeys = extractChildIssueKeys(rootIssue);
  const childIssues = [];
  const childIssueErrors = [];

  for (const childKey of childIssueKeys) {
    try {
      const childIssue = await fetchJiraViaRest(childKey, mergedEnv);
      if (childIssue && typeof childIssue === 'object') {
        childIssues.push(childIssue);
      }
    } catch (e) {
      childIssueErrors.push({
        issueKey: childKey,
        error: e && (e.message || String(e)) || 'Onbekende fout'
      });
    }
  }

  return {
    childIssueKeys: childIssueKeys,
    childIssues: childIssues,
    childIssueErrors: childIssueErrors
  };
}

async function fetchJiraViaRest(jiraKey, mergedEnv) {
  const env = mergedEnv && typeof mergedEnv === 'object' ? mergedEnv : process.env;
  const baseUrl = String(env.ATLASSIAN_BASE_URL || '').trim().replace(/\/+$/, '');
  const email = String(env.ATLASSIAN_EMAIL || '').trim();
  const token = String(env.ATLASSIAN_API_TOKEN || '').trim();

  if (!baseUrl || !email || !token) {
    throw new Error('Ontbrekende REST-credentials (ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN).');
  }

  const url = baseUrl + '/rest/api/3/issue/' + encodeURIComponent(jiraKey);
  const auth = Buffer.from(email + ':' + token, 'utf8').toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Basic ' + auth
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }

  if (!response.ok) {
    const details = data && (data.errorMessages || data.errors)
      ? JSON.stringify({ errorMessages: data.errorMessages || [], errors: data.errors || {} })
      : (text || ('HTTP ' + response.status));
    throw new Error('REST issue fetch failed: ' + response.status + ' ' + details);
  }

  return data;
}

function isLikelyTextAttachment(fileName, mimeType) {
  const name = String(fileName || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();

  if (mime.startsWith('text/')) return true;
  if (mime.includes('json') || mime.includes('xml') || mime.includes('yaml')) return true;
  if (mime.includes('rtf') || mime.includes('msword') || mime.includes('officedocument')) return true;
  if (mime.includes('pdf')) return true;

  return /\.(txt|md|markdown|csv|tsv|json|xml|yml|yaml|log|feature|gherkin|ini|cfg|conf|html?|rtf|pdf|doc|docx)$/i.test(name);
}

function resolveAtlassianAuth(mergedEnv) {
  const env = mergedEnv && typeof mergedEnv === 'object' ? mergedEnv : process.env;
  const email = String(env.ATLASSIAN_EMAIL || '').trim();
  const token = String(env.ATLASSIAN_API_TOKEN || '').trim();
  if (!email || !token) return null;
  const auth = Buffer.from(email + ':' + token, 'utf8').toString('base64');
  return { Authorization: 'Basic ' + auth };
}

function buildAttachmentCatalogFromFetched(fetched) {
  const catalog = [];
  const seen = new Set();

  const root = pickRootIssueForChecks(fetched) || {};
  const children = pickChildIssuesForChecks(fetched);
  const allIssues = [root].concat(children);

  for (const issue of allIssues) {
    if (!issue || !issue.fields || typeof issue.fields !== 'object') continue;
    const issueKey = String(issue.key || issue.issueKey || issue.id || '').trim();
    const attachments = Array.isArray(issue.fields.attachment) ? issue.fields.attachment : [];
    for (const a of attachments) {
      if (!a || typeof a !== 'object') continue;
      const id = String(a.id || a.attachmentId || '').trim();
      const filename = String(a.filename || a.name || '').trim();
      const contentUrl = String(a.content || a.url || '').trim();
      const mimeType = String(a.mimeType || a.mimetype || '').trim();
      const key = [issueKey, id, filename, contentUrl].join('|');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      catalog.push({
        issueKey: issueKey,
        id: id,
        filename: filename,
        contentUrl: contentUrl,
        mimeType: mimeType
      });
    }
  }

  return catalog;
}

function findAttachmentInCatalog(selected, catalog) {
  const issueKey = String(selected && selected.issueKey || '').trim();
  const id = String(selected && selected.id || '').trim();
  const filename = String(selected && selected.filename || '').trim();

  let hit = null;
  if (id) {
    hit = catalog.find(function(a) { return a.id && a.id === id && (!issueKey || a.issueKey === issueKey); });
    if (hit) return hit;
  }
  if (filename) {
    hit = catalog.find(function(a) { return a.filename && a.filename === filename && (!issueKey || a.issueKey === issueKey); });
  }
  return hit || null;
}

function getAttachmentExtension(fileName) {
  const name = String(fileName || '').toLowerCase().trim();
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  return name.slice(dot);
}

function isLikelyBinaryGibberish(text) {
  const s = String(text || '');
  if (!s) return false;

  if (/^PK\x03\x04/.test(s)) return true;

  let bad = 0;
  const len = s.length;
  const inspectLen = len > 12000 ? 12000 : len;
  for (let i = 0; i < inspectLen; i++) {
    const c = s.charCodeAt(i);
    const isControl = (c < 32 && c !== 9 && c !== 10 && c !== 13);
    if (isControl || c === 65533) bad++;
  }
  return inspectLen > 0 && (bad / inspectLen) > 0.02;
}

async function fetchAttachmentText(attachment, mergedEnv) {
  const url = String(attachment && attachment.contentUrl || '').trim();
  const filename = String(attachment && attachment.filename || '').trim();
  const mimeType = String(attachment && attachment.mimeType || '').trim();
  const ext = getAttachmentExtension(filename);

  if (!url) {
    return { status: 'skipped', reason: 'missing-url', text: '' };
  }
  if (!isLikelyTextAttachment(filename, mimeType)) {
    return { status: 'skipped', reason: 'unsupported-type', text: '' };
  }

  const authHeaders = resolveAtlassianAuth(mergedEnv);
  if (!authHeaders) {
    return { status: 'skipped', reason: 'missing-auth', text: '' };
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: Object.assign({ Accept: 'text/plain,application/json,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*' }, authHeaders)
  });

  if (!res.ok) {
    return { status: 'failed', reason: 'http-' + res.status, text: '' };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer || new ArrayBuffer(0));

  let text = '';

  const isDocx = ext === '.docx' || /officedocument|wordprocessingml|msword/i.test(mimeType);
  const isPdf = ext === '.pdf' || /pdf/i.test(mimeType);

  if (isDocx) {
    if (!mammoth) {
      return { status: 'skipped', reason: 'docx-parser-missing', text: '' };
    }
    try {
      const result = await mammoth.extractRawText({ buffer: buffer });
      text = String((result && result.value) || '');
    } catch (_) {
      return { status: 'failed', reason: 'docx-parse-failed', text: '' };
    }
  } else if (isPdf) {
    if (!pdfParse) {
      return { status: 'skipped', reason: 'pdf-parser-missing', text: '' };
    }
    try {
      const result = await pdfParse(buffer);
      text = String((result && result.text) || '');
    } catch (_) {
      return { status: 'failed', reason: 'pdf-parse-failed', text: '' };
    }
  } else {
    text = buffer.toString('utf8');
  }

  if (typeof text !== 'string') text = '';
  text = text.replace(/\u0000/g, '').trim();

  if (isLikelyBinaryGibberish(text)) {
    return { status: 'skipped', reason: 'binary-content', text: '' };
  }

  if (!text) {
    return { status: 'skipped', reason: 'empty-content', text: '' };
  }

  // Keep the evidence bounded so large files do not bloat the DoR payload.
  const capped = text.length > 200000 ? text.slice(0, 200000) : text;
  return { status: 'ok', reason: '', text: capped };
}

async function collectSelectedAttachmentEvidence(selectedAttachments, fetched, mergedEnv) {
  const selected = Array.isArray(selectedAttachments)
    ? selectedAttachments.filter(function(a) { return a && a.include !== false; })
    : [];

  const catalog = buildAttachmentCatalogFromFetched(fetched);
  const snippets = [];
  const extracted = [];
  const skipped = [];
  const failed = [];

  for (const chosen of selected) {
    const mapped = findAttachmentInCatalog(chosen, catalog) || {
      issueKey: String(chosen.issueKey || ''),
      id: String(chosen.id || ''),
      filename: String(chosen.filename || ''),
      contentUrl: String(chosen.contentUrl || ''),
      mimeType: String(chosen.mimeType || '')
    };

    const result = await fetchAttachmentText(mapped, mergedEnv);
    const label = (mapped.issueKey ? mapped.issueKey + ' | ' : '') + (mapped.filename || mapped.id || 'onbekende-bijlage');

    if (result.status === 'ok') {
      snippets.push('Attachment ' + label + '\n' + result.text);
      extracted.push({ label: label });
    } else if (result.status === 'skipped') {
      skipped.push({ label: label, reason: result.reason });
    } else {
      failed.push({ label: label, reason: result.reason });
    }
  }

  return {
    selectedCount: selected.length,
    extractedCount: snippets.length,
    extracted: extracted,
    skipped: skipped,
    failed: failed,
    snippets: snippets
  };
}

function extractAdfTextForChecks(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractAdfTextForChecks).filter(Boolean).join('');
  if (typeof node !== 'object') return '';

  if (node.type === 'text') return String(node.text || '');

  const content = Array.isArray(node.content) ? node.content : [];
  const inner = content.map(extractAdfTextForChecks).join('');
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') return inner + '\n';
  if (node.type === 'hardBreak') return '\n';
  return inner;
}

function getIssueDescriptionForChecks(issue) {
  if (!issue || !issue.fields || typeof issue.fields !== 'object') return '';
  const d = issue.fields.description;
  if (!d) return '';
  if (typeof d === 'string') return d.trim();
  if (typeof d === 'object') return extractAdfTextForChecks(d).replace(/\n{3,}/g, '\n\n').trim();
  return '';
}

function pickRootIssueForChecks(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.issue && typeof data.issue === 'object') return data.issue;
  if (data.rootIssue && typeof data.rootIssue === 'object') return data.rootIssue;
  if (data.jiraIssue && typeof data.jiraIssue === 'object') return data.jiraIssue;
  if (data.key || data.fields) return data;
  return null;
}

function pickChildIssuesForChecks(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.childIssues)) return data.childIssues.filter(function(x) { return x && typeof x === 'object'; });
  if (Array.isArray(data.subIssues)) return data.subIssues.filter(function(x) { return x && typeof x === 'object'; });
  if (Array.isArray(data.underlyingIssues)) return data.underlyingIssues.filter(function(x) { return x && typeof x === 'object'; });
  return [];
}

function buildHarvestMetaFromFetched(fetched) {
  const root = pickRootIssueForChecks(fetched) || {};
  const children = pickChildIssuesForChecks(fetched);

  const rootUpdated = root && root.fields && typeof root.fields === 'object'
    ? String(root.fields.updated || '').trim()
    : '';

  const childMap = {};
  children.forEach(function(issue) {
    const key = getIssueKeyForSummary(issue);
    const updated = issue && issue.fields && typeof issue.fields === 'object'
      ? String(issue.fields.updated || '').trim()
      : '';
    if (!key || !updated) return;
    childMap[key] = updated;
  });

  return {
    harvestedAt: new Date().toISOString(),
    jiraUpdated: rootUpdated,
    children: childMap
  };
}

async function buildDorCheckFromFetched(fetched, selectedAttachments, mergedEnv) {
  const root = pickRootIssueForChecks(fetched) || {};
  const children = pickChildIssuesForChecks(fetched);
  const descriptions = [root].concat(children).map(getIssueDescriptionForChecks).filter(Boolean);
  const attachmentEvidence = await collectSelectedAttachmentEvidence(selectedAttachments, fetched, mergedEnv);
  const fullText = descriptions.concat(attachmentEvidence.snippets || []).join('\n\n').toLowerCase();

  function hasAny(patterns) {
    return patterns.some(function(p) { return p.test(fullText); });
  }

  const items = [];

  const stableOk = hasAny([/functioneel/, /stabiel/, /werkt\s+correct/, /goedgekeurd/, /accepted/, /ready\s+for\s+test/i]);
  items.push({
    id: 'dor-functional-stability',
    labelNl: 'Functional Stability',
    status: stableOk ? 'ok' : 'warning',
    notes: stableOk
      ? 'Indicaties van functionele stabiliteit gevonden in Jira-beschrijving.'
      : 'Geen harde bevestiging van functionele stabiliteit gevonden in de huidige Jira-gegevens.'
  });

  const acceptanceCriteriaPresent = hasAny([
    /acceptatie\s*criteria/,
    /acceptance\s*criteria/,
    /\bac\b\s*:/,
    /\bcriteria\b/,
    /\brequirements?\b/,
    /\bmust\b/,
    /\bshall\b/
  ]);
  const gherkinOk = hasAny([/\bgiven\b/, /\bwhen\b/, /\bthen\b/]);

  let acceptanceStatus = 'warning';
  if (acceptanceCriteriaPresent && gherkinOk) acceptanceStatus = 'ok';

  items.push({
    id: 'dor-acceptance-criteria',
    labelNl: 'Acceptatie Criteria',
    status: acceptanceStatus,
    notes: 'Aanwezigheid: '
      + (acceptanceCriteriaPresent ? 'OK' : 'Ontbreekt')
      + '\nFormat (Given/When/Then): '
      + (gherkinOk ? 'OK' : 'Ontbreekt')
  });

  const testDataOk = hasAny([/test\s*data/, /testdata/, /dataset/, /records?/, /gebruikers?/, /users?/, /rollen?/, /roles?/]);
  items.push({
    id: 'dor-test-data',
    labelNl: 'Test Data',
    status: testDataOk ? 'ok' : 'warning',
    notes: testDataOk
      ? 'Verwijzingen naar testdata/dataset gevonden.'
      : 'Geen duidelijke testdata- of datasetinformatie gevonden.'
  });

  const accessOk = hasAny([/\biam\b/, /permissions?/, /toegang/, /authorisatie/, /autorisatie/, /rechten/, /roles?/]);
  items.push({
    id: 'dor-access',
    labelNl: 'Access / IAM',
    status: accessOk ? 'ok' : 'warning',
    notes: accessOk
      ? 'Toegangs- of IAM-informatie gevonden.'
      : 'Geen expliciete toegangs- of IAM-informatie gevonden.'
  });

  const allPassed = items.every(function(item) { return item.status === 'ok'; });

  return {
    checkedAt: new Date().toISOString(),
    source: path.relative(WORKSPACE, dorDodInstructionsPath).replace(/\\/g, '/'),
    sourceSection: 'Definition of Ready (DoR)',
    evidence: {
      descriptionsUsed: descriptions.length,
      selectedAttachments: attachmentEvidence.selectedCount,
      extractedAttachmentTexts: attachmentEvidence.extractedCount,
      skippedAttachments: attachmentEvidence.skipped,
      failedAttachments: attachmentEvidence.failed
    },
    items: items,
    allPassed: allPassed
  };
}

async function buildTestabilityCheckFromFetched(fetched, selectedAttachments, mergedEnv) {
  const root = pickRootIssueForChecks(fetched) || {};
  const children = pickChildIssuesForChecks(fetched);
  const descriptions = [root].concat(children).map(getIssueDescriptionForChecks).filter(Boolean);
  const attachmentEvidence = await collectSelectedAttachmentEvidence(selectedAttachments, fetched, mergedEnv);
  const fullText = descriptions.concat(attachmentEvidence.snippets || []).join('\n\n').toLowerCase();

  function hasAny(patterns) {
    return patterns.some(function(p) { return p.test(fullText); });
  }

  const testBasisOk = hasAny([
    /user\s*story/,
    /acceptatie\s*criteria/,
    /acceptance\s*criteria/,
    /definition\s*of\s*ready/,
    /\bdor\b/,
    /definition\s*of\s*done/,
    /\bdod\b/,
    /refinement/,
    /requirements?/
  ]);

  const verifiableOutcomeOk = hasAny([
    /expected/,
    /verwacht/,
    /resultaat/,
    /assert/,
    /controle/,
    /validat/,
    /status/,
    /melding/,
    /output/
  ]);

  const testDataOk = hasAny([
    /test\s*data/,
    /testdata/,
    /dataset/,
    /records?/,
    /gebruikers?/,
    /users?/,
    /rollen?/,
    /roles?/
  ]);

  const riskPriorityOk = hasAny([
    /risico/,
    /risk/,
    /prioriteit/,
    /priority/,
    /\bhigh\b/,
    /\bmedium\b/,
    /\blow\b/
  ]);

  const items = [];
  items.push({
    id: 'testability-basis',
    labelNl: 'Testbasis aanwezig',
    status: testBasisOk ? 'ok' : 'warning',
    notes: testBasisOk
      ? 'Er is een testbasis herkend (bijv. user story, acceptance criteria, DoR/DoD of refinement-notes).'
      : 'Geen duidelijke testbasis gevonden (user story, acceptance criteria, DoR/DoD of refinement-notes).'
  });
  items.push({
    id: 'testability-verifiable-outcome',
    labelNl: 'Verifieerbare uitkomst',
    status: verifiableOutcomeOk ? 'ok' : 'warning',
    notes: verifiableOutcomeOk
      ? 'Er zijn verifieerbare verwachte uitkomsten/herkenbare assertions gevonden.'
      : 'Onvoldoende verifieerbare verwachte uitkomsten gevonden.'
  });
  items.push({
    id: 'testability-data',
    labelNl: 'Testdata benoemd',
    status: testDataOk ? 'ok' : 'warning',
    notes: testDataOk
      ? 'Er zijn aanwijzingen voor benodigde testdata gevonden.'
      : 'Geen duidelijke testdata-informatie gevonden.'
  });
  items.push({
    id: 'testability-risk-priority',
    labelNl: 'Risico/Prioriteit context',
    status: riskPriorityOk ? 'ok' : 'warning',
    notes: riskPriorityOk
      ? 'Risico- of prioriteitscontext is aanwezig voor testfocus.'
      : 'Geen expliciete risico- of prioriteitscontext gevonden.'
  });

  const isTestable = testBasisOk && verifiableOutcomeOk && testDataOk;

  return {
    checkedAt: new Date().toISOString(),
    source: path.relative(WORKSPACE, testIstqbInstructionsPath).replace(/\\/g, '/'),
    sourceSection: 'ISTQB testability pre-check',
    evidence: {
      descriptionsUsed: descriptions.length,
      selectedAttachments: attachmentEvidence.selectedCount,
      extractedAttachmentTexts: attachmentEvidence.extractedCount,
      skippedAttachments: attachmentEvidence.skipped,
      failedAttachments: attachmentEvidence.failed
    },
    items: items,
    isTestable: isTestable
  };
}

function getIssueKeyForSummary(issue) {
  if (!issue || typeof issue !== 'object') return '';
  return String(issue.key || issue.issueKey || issue.id || '').trim();
}

function getIssueTitleForSummary(issue) {
  if (!issue || typeof issue !== 'object') return '';
  if (issue.fields && typeof issue.fields === 'object') {
    return String(issue.fields.summary || '').trim();
  }
  return String(issue.summary || issue.title || '').trim();
}

function getIssueCommentsForSummary(issue) {
  const out = [];
  if (!issue || !issue.fields || typeof issue.fields !== 'object') return out;
  const c = issue.fields.comment;
  if (!c || typeof c !== 'object') return out;
  const comments = Array.isArray(c.comments) ? c.comments : [];
  comments.forEach(function(item) {
    if (!item || typeof item !== 'object') return;
    const author = item.author && typeof item.author === 'object'
      ? String(item.author.displayName || item.author.name || item.author.emailAddress || '').trim()
      : '';
    const created = String(item.created || '').trim();
    const body = item.body;
    let text = '';
    if (typeof body === 'string') text = body.trim();
    else if (body && typeof body === 'object') text = extractAdfTextForChecks(body).replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return;
    out.push({ author: author, created: created, text: text });
  });
  return out;
}

function isLikelyImageAttachment(fileName, mimeType) {
  const name = String(fileName || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function truncateForSummary(text, maxLen) {
  const s = String(text || '');
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '...';
}

async function generateSummaryMarkdownFromFetched(fetched, answers, dorData, testabilityData, mergedEnv) {
  const root = pickRootIssueForChecks(fetched) || {};
  const children = pickChildIssuesForChecks(fetched);
  const allIssues = [root].concat(children);

  const rootKey = getIssueKeyForSummary(root) || String((answers && answers.jiraKey) || '').trim() || 'ONBEKEND';
  const rootTitle = getIssueTitleForSummary(root) || 'Jira item';
  const now = new Date();
  const generatedAt = now.toLocaleString('nl-NL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const selectedAttachments = Array.isArray(answers && answers.selectedAttachments)
    ? answers.selectedAttachments.filter(function(a) { return a && a.include !== false; })
    : [];

  const attachmentCatalog = buildAttachmentCatalogFromFetched(fetched);
  const mappedSelectedAttachments = selectedAttachments.map(function(sel) {
    const mapped = findAttachmentInCatalog(sel, attachmentCatalog) || {};
    return {
      include: true,
      issueKey: String(mapped.issueKey || sel.issueKey || '').trim(),
      id: String(mapped.id || sel.id || '').trim(),
      filename: String(mapped.filename || sel.filename || '').trim(),
      contentUrl: String(mapped.contentUrl || sel.contentUrl || '').trim(),
      mimeType: String(mapped.mimeType || sel.mimeType || '').trim()
    };
  });

  const attachmentEvidence = await collectSelectedAttachmentEvidence(mappedSelectedAttachments, fetched, mergedEnv);

  function normalizeText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function splitNoteLines(note, fallback) {
    var raw = String(note || fallback || '').replace(/\r\n/g, '\n');
    return raw
      .split(/\n+/)
      .map(function(line) { return normalizeText(line); })
      .filter(Boolean);
  }

  function splitIntoSentences(text) {
    return String(text || '')
      .split(/(?<=[.!?])\s+|\n+/)
      .map(function(s) { return normalizeText(s); })
      .filter(function(s) { return s.length >= 25; });
  }

  function scoreSentence(sentence) {
    var s = String(sentence || '').toLowerCase();
    var score = 0;
    var signals = [
      /acceptatie|acceptance|given|when|then/,
      /risico|risk|impact|prioriteit|priority/,
      /testdata|dataset|record|user|rol|role/,
      /verwacht|expected|resultaat|assert|validat|controle/,
      /fout|error|probleem|issue|blokker|blocker/,
      /scope|afhankelijk|dependency|randvoorwaarde|voorwaarde/
    ];
    signals.forEach(function(rx) { if (rx.test(s)) score += 2; });
    if (s.length >= 80) score += 1;
    if (s.length >= 140) score += 1;
    return score;
  }

  function takeTopSentencesFromTexts(texts, maxItems) {
    var bag = [];
    var seen = new Set();
    (texts || []).forEach(function(t) {
      splitIntoSentences(t).forEach(function(sentence) {
        var key = sentence.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        bag.push({ sentence: sentence, score: scoreSentence(sentence) });
      });
    });

    bag.sort(function(a, b) { return b.score - a.score; });
    return bag.slice(0, maxItems).map(function(x) { return x.sentence; });
  }

  function takeTopSentencesByTheme(texts, themeRegexes, maxItems) {
    var bag = [];
    var seen = new Set();
    (texts || []).forEach(function(t) {
      splitIntoSentences(t).forEach(function(sentence) {
        var lower = sentence.toLowerCase();
        var key = lower;
        if (seen.has(key)) return;
        var hit = themeRegexes.some(function(rx) { return rx.test(lower); });
        if (!hit) return;
        seen.add(key);
        bag.push({ sentence: sentence, score: scoreSentence(sentence) + 2 });
      });
    });
    bag.sort(function(a, b) { return b.score - a.score; });
    return bag.slice(0, maxItems).map(function(x) { return x.sentence; });
  }

  const lines = [];
  lines.push('# ' + rootKey + ' — ' + rootTitle);
  lines.push('');
  lines.push('## Status');
  lines.push('**Aangemaakt:** ' + generatedAt);
  lines.push('');

  lines.push('## Pre-check aandachtspunten (niet voldaan)');
  const dorFailed = (dorData && Array.isArray(dorData.items) ? dorData.items : []).filter(function(i) { return (i.status || 'warning') !== 'ok'; });
  const testFailed = (testabilityData && Array.isArray(testabilityData.items) ? testabilityData.items : []).filter(function(i) { return (i.status || 'warning') !== 'ok'; });
  if (!dorFailed.length && !testFailed.length) {
    lines.push('Geen afwijkingen vastgesteld in DoR en Testbaarheid checks.');
  } else {
    dorFailed.forEach(function(item) {
      lines.push('[DoR] ' + String(item.labelNl || item.label || 'Onbekend criterium') + ':');
      splitNoteLines(item.notes, 'Niet voldaan.').forEach(function(line) {
        lines.push('\t• ' + line);
      });
    });
    testFailed.forEach(function(item) {
      lines.push('[Testbaarheid] ' + String(item.labelNl || item.label || 'Onbekend criterium') + ':');
      splitNoteLines(item.notes, 'Niet voldaan.').forEach(function(line) {
        lines.push('\t• ' + line);
      });
    });
    if (testabilityData && testabilityData.isTestable === false) {
      lines.push('[Testbaarheid] Overkoepelend oordeel:');
      lines.push('\t• item is momenteel niet voldoende testbaar.');
    }
  }
  lines.push('');

  lines.push('## Jira items overzicht');
  lines.push('- Root item: ' + rootKey + ' - ' + rootTitle);
  if (!children.length) {
    lines.push('- Sub-items: geen.');
  } else {
    children.forEach(function(issue) {
      const k = getIssueKeyForSummary(issue) || 'Onbekend';
      const t = getIssueTitleForSummary(issue) || 'Zonder titel';
      lines.push('- Sub-item: ' + k + ' - ' + t);
    });
  }
  lines.push('');

  var descriptionTexts = [];
  allIssues.forEach(function(issue) {
    var d = getIssueDescriptionForChecks(issue);
    if (d) descriptionTexts.push(d);
  });

  var commentTexts = [];
  var totalComments = 0;
  allIssues.forEach(function(issue) {
    const k = getIssueKeyForSummary(issue) || 'Onbekend';
    const comments = getIssueCommentsForSummary(issue);
    totalComments += comments.length;
    comments.forEach(function(c) {
      const meta = [k, c.author || 'Onbekende auteur', c.created || 'onbekende datum'].join(' | ');
      commentTexts.push(meta + '. ' + c.text);
    });
  });

  var overallCorpus = [];
  descriptionTexts.forEach(function(t) { overallCorpus.push(t); });
  commentTexts.forEach(function(t) { overallCorpus.push(t); });
  (attachmentEvidence.snippets || []).forEach(function(t) { overallCorpus.push(t); });

  lines.push('## Overkoepelende samenvatting');
  if (!overallCorpus.length) {
    lines.push('- Geen inhoud beschikbaar om een samenvatting op te bouwen.');
  } else {
    var overallTop = takeTopSentencesFromTexts(overallCorpus, 24);
    if (!overallTop.length) {
      lines.push('- Broninhoud aanwezig, maar geen duidelijke kernzinnen gevonden.');
    } else {
      overallTop.forEach(function(sentence) {
        lines.push('- ' + sentence);
      });
    }

    var testGoalSignals = takeTopSentencesByTheme(overallCorpus, [
      /doel|scope|proces|stap|flow|functionaliteit|feature|user\s*story|epic|story/,
      /acceptatie|acceptance|given|when|then|verwacht|expected|resultaat/
    ], 8);
    lines.push('');
    lines.push('### Verdieping voor testontwerp');
    if (testGoalSignals.length) {
      lines.push('- Doel en scope-signalen:');
      testGoalSignals.forEach(function(s) { lines.push('  - ' + s); });
    } else {
      lines.push('- Doel en scope-signalen: geen expliciete signalen gevonden.');
    }

    var testDataSignals = takeTopSentencesByTheme(overallCorpus, [
      /test\s*data|testdata|dataset|record|gebruikers?|users?|rollen?|roles?|iam|rechten|permission|toegang/
    ], 8);
    if (testDataSignals.length) {
      lines.push('- Testdata en toegang:');
      testDataSignals.forEach(function(s) { lines.push('  - ' + s); });
    } else {
      lines.push('- Testdata en toegang: niet expliciet uitgewerkt in de beschikbare bronnen.');
    }

    var riskSignals = takeTopSentencesByTheme(overallCorpus, [
      /risico|risk|impact|blokker|blocker|fout|error|afhankelijk|dependency|randvoorwaarde|constraint|beperking/
    ], 8);
    if (riskSignals.length) {
      lines.push('- Risico\'s en afhankelijkheden:');
      riskSignals.forEach(function(s) { lines.push('  - ' + s); });
    } else {
      lines.push('- Risico\'s en afhankelijkheden: geen expliciete signalen gevonden.');
    }

  }
  lines.push('');

  lines.push('## Brondekking');
  lines.push('- Beschrijvingen gebruikt: ' + String(descriptionTexts.length));
  lines.push('- Opmerkingen gebruikt: ' + String(totalComments));
  lines.push('- Geselecteerde bijlagen: ' + String(mappedSelectedAttachments.length));
  lines.push('- Bijlagen met tekstextract: ' + String(attachmentEvidence.extractedCount || 0));
  if (attachmentEvidence.extracted && attachmentEvidence.extracted.length) {
    lines.push('- Verwerkte bijlagen:');
    attachmentEvidence.extracted.forEach(function(x) {
      lines.push('  - ' + String(x.label || 'onbekende bijlage'));
    });
  }
  if (attachmentEvidence.skipped && attachmentEvidence.skipped.length) {
    lines.push('- Overgeslagen bijlagen:');
    attachmentEvidence.skipped.forEach(function(s) {
      lines.push('  - ' + String(s.label || 'onbekende bijlage') + ' | reden: ' + String(s.reason || 'onbekend'));
    });
  }
  if (attachmentEvidence.skipped && attachmentEvidence.skipped.length) {
    var skippedImageCount = attachmentEvidence.skipped.filter(function(s) {
      return /unsupported-type/.test(String(s.reason || ''));
    }).length;
    if (skippedImageCount) {
      lines.push('- Let op: een deel van de overgeslagen bijlagen heeft geen direct tekstextract (bijv. afbeelding of niet-ondersteund type).');
    }
  }
  if (attachmentEvidence.failed && attachmentEvidence.failed.length) {
    lines.push('- Mislukte bijlageverwerking:');
    attachmentEvidence.failed.forEach(function(f) {
      lines.push('  - ' + String(f.label || 'onbekende bijlage') + ' | fout: ' + String(f.reason || 'onbekend'));
    });
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async function(req, res) {
  const url = (req.url || '/').split('?')[0];

  // ── Splash ──────────────────────────────────────────────────────────────
  if (url === '/' || url === '/splash') {
    const imgHtml = splashImgSrc
      ? '<img src="' + splashImgSrc + '" class="splash-img" alt="Harvest">'
      : '<div class="splash-placeholder">Harvest</div>';
    const cornerImgHtml = splashCornerImgSrc
      ? '<div class="splash-corner"><img src="' + splashCornerImgSrc + '" class="splash-corner-img" alt="AI generated"></div>'
      : '';

    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><meta name="google" content="notranslate">'
      + '<style>' + CSS + '</style></head><body>'
      + '<div class="splash">'
      + '<img src="' + LOGO + '" class="splash-logo" alt="Acto">'
      + imgHtml
      + cornerImgHtml
      + '<div class="splash-footer">'
      + '<div class="spinner"></div>'
      + '<div class="splash-title">Harvest wordt geladen\u2026</div>'
      + '<div class="splash-sub">Even geduld\u2026</div>'
      + '</div>'
      + '</div>'
      + '<script>setTimeout(function(){location.href="/wizard";},' + SPLASH_STANDARD.durationMs + ');<\/script>'
      + '</body></html>';

    return send(res, 200, 'text/html', html);
  }

  // ── Wizard form ─────────────────────────────────────────────────────────
  if (url === '/wizard') {
    const health = getMcpConfigHealth();
    const healthWarningHtml = health.isHealthy
      ? ''
      : '<div style="margin:10px 0 14px;padding:10px 12px;border:1px solid #f0d98c;background:#fff8e6;border-radius:8px;color:#6b5400;font-size:.88rem;">'
      + '<strong>MCP-config nog niet compleet.</strong><br>'
      + (health.unresolvedInputs.length
        ? 'In .vscode/mcp.json staan nog ${input:...} placeholders voor: ' + escHtml(health.unresolvedInputs.join(', ')) + '.'
        : 'Ontbrekende waarden in .vscode/mcp.json: ' + escHtml(health.missingValues.join(', ')) + '.')
      + '</div>';

    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><meta name="google" content="notranslate">'
      + '<style>' + CSS + '</style></head><body>'
      + '<div class="page-wrap">'
      + '<div class="card">'
      + '<div class="page-title">Jira issue ophalen</div>'
      + '<h1>Wat is het Jira nummer?</h1>'
      + '<form id="f" action="/submit" method="POST" novalidate>'
      + '<input type="text" id="jiraKey" name="jiraKey" placeholder="bijv. RB-1234"'
      + ' autocomplete="off" autofocus spellcheck="false" required>'
      + '<div class="error" id="err-required">Dit veld is verplicht. Vul een Jira-issuenummer in.</div>'
      + '<div class="error" id="err-format">Ongeldig formaat. Gebruik bijv. RB-1234 (letters gevolgd door een koppelteken en cijfers).</div>'
      + healthWarningHtml
      + '<div class="actions">'
      + '<button type="submit" class="btn" id="sub" style="display:none">Volgende &#8594;</button>'
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '</form>'
      + '</div>'
      + '</div>'
      + '<script>'
      + 'var KEY_RE=/^[A-Z]{2,}-\\d+$/;'
      // Force uppercase and normalize dash as user types
      + 'var inp=document.getElementById("jiraKey");'
      + 'var sub=document.getElementById("sub");'
      + 'function updateNextVisibility(){'
      + '  var v=inp.value.trim();'
      + '  sub.style.display=KEY_RE.test(v)?"inline-flex":"none";'
      + '}'
      + 'function normalizeKey(v){'
      + '  v=v.toUpperCase();'
      + '  v=v.replace(/^([A-Z]+)-?(\\d+)$/,"$1-$2");'
      + '  return v;'
      + '}'
      + 'inp.addEventListener("input",function(){'
      + '  var pos=this.selectionStart;'
      + '  var norm=normalizeKey(this.value);'
      + '  var added=norm.length-this.value.length;'
      + '  this.value=norm;'
      + '  this.setSelectionRange(pos+added,pos+added);'
      + '  updateNextVisibility();'
      + '});'
      + 'inp.addEventListener("keydown",function(e){'
      + '  if(e.key==="Enter"){e.preventDefault();}'
      + '});'
      // Validate on submit
      + 'updateNextVisibility();'
      + 'document.getElementById("f").addEventListener("submit",function(e){'
      + '  var v=inp.value.trim();'
      + '  inp.value=v;'
      + '  document.getElementById("err-required").style.display="none";'
      + '  document.getElementById("err-format").style.display="none";'
      + '  if(v===""){e.preventDefault();document.getElementById("err-required").style.display="block";inp.focus();return;}'
      + '  if(!KEY_RE.test(v)){e.preventDefault();document.getElementById("err-format").style.display="block";inp.focus();return;}'
      + '  document.getElementById("sub").disabled=true;'
      + '  document.getElementById("sub").textContent="Bezig\u2026";'
      + '});'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Form submit ──────────────────────────────────────────────────────────
  if (url === '/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const params = parseForm(body);
    const jiraKey = (params.jiraKey || '').trim().toUpperCase().replace(/^([A-Z]+)-?(\d+)$/, '$1-$2');

    if (!/^[A-Z]{2,}-\d+$/.test(jiraKey)) {
      res.writeHead(302, { Location: '/wizard' }); res.end();
      return;
    }

    const answers = { jiraKey: jiraKey };
    fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2), 'utf8');
    fs.writeFileSync(actionPath, '', 'utf8');

    // Clear any stale summary and DoR check from a previous run so /working waits for fresh data
    if (fs.existsSync(fetchedPath))          fs.unlinkSync(fetchedPath);
    if (fs.existsSync(fetchErrorPath))       fs.unlinkSync(fetchErrorPath);
    if (fs.existsSync(summaryPath))          fs.unlinkSync(summaryPath);
    if (fs.existsSync(summaryConfirmedPath)) fs.unlinkSync(summaryConfirmedPath);
    if (fs.existsSync(dorCheckPath))         fs.unlinkSync(dorCheckPath);
    if (fs.existsSync(testabilityCheckPath)) fs.unlinkSync(testabilityCheckPath);

    console.log('RESULT:bevestigd');

    // Trigger Jira fetch immediately from the wizard process.
    var fetchFinished = false;
    fetchJiraViaMcp(jiraKey)
      .then(function() { fetchFinished = true; })
      .catch(function(e) {
        fetchFinished = true;
        writeFetchError('mcp-fetch-failed', 'Jira ophalen via MCP is mislukt.', e && (e.message || String(e)) || 'Onbekende fout');
      });

    // Fail-safe: never leave /working spinning forever without outcome files.
    setTimeout(function() {
      if (fetchFinished) return;
      if (fs.existsSync(fetchedPath) || fs.existsSync(fetchErrorPath)) return;
      writeFetchError('mcp-timeout', 'Jira ophalen via MCP duurt te lang.', 'Er is na 120 seconden geen resultaat ontvangen van de MCP-server. Eerste startup via npx kan langer duren. Controleer netwerk, credentials en MCP package startup.');
    }, 120000);

    try { if (fs.existsSync(warningPath)) fs.unlinkSync(warningPath); } catch(_){ }
    res.writeHead(302, { Location: '/working' }); res.end();
    return;
  }

  // ── Working — progress bar while agent fetches Jira data ──────────────
  if (url === '/working') {
    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + CSS + '</style>'
      + '<style>'
      + '.watermark{position:fixed;bottom:24px;right:24px;width:180px;opacity:0.08;pointer-events:none;z-index:0;}'
      + '.progress-wrap{width:100%;max-width:420px;margin:20px 0 6px;}'
      + '.progress-track{width:100%;height:10px;background:#dde3f0;border-radius:6px;overflow:hidden;}'
      + '.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#0052cc,#2684ff);'
      + 'border-radius:6px;transition:width 0.4s ease;}'
      + '.progress-pct{font-size:.85rem;color:#0052cc;font-weight:600;margin-top:6px;text-align:right;}'
      + '<\/style>'
      + '</head><body>'
      + '<img src="' + JIRA_LOGO + '" alt="" class="watermark" aria-hidden="true">'
      + '<div class="working">'
      + '<h2 id="status-text">Jira-gegevens worden opgehaald\u2026</h2>'
      + '<div class="progress-wrap">'
      + '  <div class="progress-track"><div class="progress-fill" id="pbar"></div></div>'
      + '  <div class="progress-pct" id="pct">0%</div>'
      + '</div>'
      + '<p>Even geduld</p>'
      + '<div id="stuck-help" style="display:none;margin-top:18px;padding:12px 16px;'
      + 'background:#fff8e6;border:1px solid #f0d98c;border-radius:8px;font-size:.88rem;color:#6b5400;">'
      + 'Dit duurt langer dan verwacht. De achtergrondverwerking loopt mogelijk nog door.&nbsp; '
      + '<a href="javascript:location.reload()">Vernieuwen</a>'
      + '</div>'
      + '</div>'
      + '<script>'
      // Progress animation — fast approach to 60%, then slow crawl to 99%, snaps to 100% when ready
      + 'var pv=0;'
      + 'var pb=document.getElementById("pbar");'
      + 'var pt=document.getElementById("pct");'
      + 'function setP(v){'
      + '  pv=v;'
      + '  pb.style.width=v.toFixed(1)+"%";'
      + '  pt.textContent=Math.round(v)+"%";'
      + '}'
      + 'function advance(){'
      + '  if(pv<99){'
      + '    var step=pv<60?Math.max((60-pv)*0.04,0.15):0.1;'
      + '    setP(Math.min(pv+step,99));'
      + '  }'
      + '  setTimeout(advance,350);'
      + '}'
      + 'advance();'
      + 'var statusEl=document.getElementById("status-text");'
      + 'function setStatus(t){if(statusEl)statusEl.textContent=t;}'
      // If no progress/state-change is observed within ~60s, show a manual recovery option
      // instead of spinning silently forever (this is the safeguard for the "stuck on
      // working page" class of bug — even if the underlying cause recurs, the user always
      // gets a visible, actionable way out).
      + 'var phaseStart=Date.now();'
      + 'var phase="waiting";'
      + 'function setPhase(next){if(next!==phase){phase=next;phaseStart=Date.now();}}'
      + 'function poll(){'
      + '  fetch("/status-all?ts="+Date.now(),{cache:"no-store"}).then(function(r){return r.json();})'
      + '  .then(function(d){'
      + '    if(d.fetchError){location.href="/fetch-error";return;}'
      + '    if(d.fetched){setP(100);setTimeout(function(){location.href="/fetch-result";},400);return;}'
      + '    else{setPhase("waiting");setStatus("Jira-gegevens worden opgehaald\u2026");}'
      + '    if(phase==="waiting" && Date.now()-phaseStart>120000){'
      + '      var h=document.getElementById("stuck-help");if(h)h.style.display="block";'
      + '    }'
      + '    setTimeout(poll,1000);'
      + '  }).catch(function(){'
      + '    if(Date.now()-phaseStart>120000){'
      + '      var h=document.getElementById("stuck-help");if(h)h.style.display="block";'
      + '    }'
      + '    setTimeout(poll,2000);'
      + '  });'
      + '}'
      + 'setTimeout(poll,800);'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Polled by /working to detect when jira-dor-check.json is written ───────
  if (url === '/dor-ready') {
    const ready = fs.existsSync(dorCheckPath);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({ ready: ready }));
    return;
  }

  // ── Polled by /working to detect when jira-testability-check.json is written ──
  if (url === '/testability-ready') {
    const ready = fs.existsSync(testabilityCheckPath);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({ ready: ready }));
    return;
  }

  // ── Pre-check — renders DoR + testability checks ─────────────────────────
  if (url === '/pre-check' || url === '/dor-check') {
    var dorData = { items: [], allPassed: false };
    try { dorData = JSON.parse(fs.readFileSync(dorCheckPath, 'utf8')); } catch (_) {
      res.writeHead(302, { Location: '/working' }); res.end(); return;
    }

    var testabilityData = { items: [], isTestable: false };
    var testabilityKnown = false;
    try {
      testabilityData = JSON.parse(fs.readFileSync(testabilityCheckPath, 'utf8'));
      testabilityKnown = true;
    } catch (_) {}

    var iconMap = { ok: '&#10003;', warning: '&#9888;', fail: '&#10007;' };
    var colorMap = { ok: '#36b37e', warning: '#ff991f', fail: '#de350b' };
    var bgMap    = { ok: '#f0faf4', warning: '#fffbe6', fail: '#fff0ee' };

    function renderItems(items) {
      var html = '';
      (items || []).forEach(function(item) {
        var st = item.status || 'warning';
        var icon = iconMap[st] || '?';
        var color = colorMap[st] || '#888';
        var bg = bgMap[st] || '#fff';
        var noteHtml = escHtml(item.notes || '').replace(/\n/g, '<br>');
        html += '<div style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;'
          + 'background:' + bg + ';border:1px solid #dde;border-left:4px solid ' + color + ';'
          + 'border-radius:8px;margin-bottom:10px;">'
          + '<span style="font-size:1.3rem;color:' + color + ';flex-shrink:0;margin-top:1px;">' + icon + '</span>'
          + '<div><div style="font-weight:700;color:#1a1a1a;margin-bottom:3px;">'
          + escHtml(item.labelNl || item.label || '') + '</div>'
          + '<div style="color:#555;font-size:.9rem;">' + noteHtml + '</div>'
          + '</div></div>\n';
      });
      return html;
    }

    var dorItemsHtml = renderItems(dorData.items || []);
    var testabilityItemsHtml = renderItems(testabilityData.items || []);

    var dorWarningBanner = '';
    if (!dorData.allPassed) {
      dorWarningBanner = '<div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;'
        + 'padding:12px 16px;margin-bottom:20px;color:#7c5914;font-size:.9rem;">'
        + '&#9888;&nbsp; Niet alle DoR-criteria zijn aantoonbaar vervuld. '
        + 'Je kunt toch doorgaan, maar wees je bewust van de risico\'s.</div>';
    }

    var testabilityWarningBanner = '';
    if (!testabilityKnown || !testabilityData.isTestable) {
      testabilityWarningBanner = '<div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;'
        + 'padding:12px 16px;margin-bottom:20px;color:#7c5914;font-size:.9rem;">'
        + '&#9888;&nbsp; Dit item is (nog) niet voldoende testbaar op basis van de huidige input. '
        + 'Vul ontbrekende informatie aan voordat je testcases opstelt.'
        + (!testabilityKnown ? '<div style="margin-top:8px;color:#6b778c;font-size:.88rem;">Testability-checkbestand ontbreekt; waarschuwing wordt uit voorzorg getoond.</div>' : '')
        + '</div>';
    }

    var itemsHtml = '';
    itemsHtml += '<h3 style="margin:4px 0 10px;color:#172b4d;font-size:1.05rem;">DoR check</h3>';
    itemsHtml += dorWarningBanner + dorItemsHtml;
    itemsHtml += '<h3 style="margin:22px 0 10px;color:#172b4d;font-size:1.05rem;">Testbaarheid check</h3>';
    itemsHtml += testabilityWarningBanner + testabilityItemsHtml;

    var logoHtml = '<img src="' + LOGO + '" class="logo" alt="Logo" style="height:auto;max-height:60px;width:auto;margin-right:16px;">';
    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + SUMMARY_CSS + '</style></head><body>'
      + '<div class="top-header">' + logoHtml
      + '<div class="issue-header">'
      + '<span class="issue-title">Pre-check \u2014 DoR en Testbaarheid</span>'
      + '</div></div>'
      + '<div style="padding:8px 0 100px">'
      + itemsHtml
      + '</div>'
      + '<div class="actions">'
      + '<button class="btn" id="btnOk" onclick="bevestig()">Doorgaan &#8594;</button>'
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '<script>'
      + 'function bevestig(){'
      + '  document.getElementById("btnOk").disabled=true;'
      + '  document.getElementById("btnOk").textContent="Bezig\u2026";'
      + '  fetch("/confirm-precheck",{method:"POST"}).then(function(){location.href="/working-summary";});'
      + '}'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── User acknowledges pre-check (DoR + testability) ─────────────────────
  if ((url === '/confirm-precheck' || url === '/confirm-dor') && req.method === 'POST') {
    let fetched = {};
    let answers = {};
    let dorData = { items: [], allPassed: false };
    let testabilityData = { items: [], isTestable: false };
    try { fetched = JSON.parse(fs.readFileSync(fetchedPath, 'utf8')); } catch (_) {}
    try { answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')); } catch (_) {}
    try { dorData = JSON.parse(fs.readFileSync(dorCheckPath, 'utf8')); } catch (_) {}
    try { testabilityData = JSON.parse(fs.readFileSync(testabilityCheckPath, 'utf8')); } catch (_) {}

    const health = getMcpConfigHealth();
    const launch = health.launch;
    launch.mergedEnv = buildMcpEnv(launch.env);

    const summaryMd = await generateSummaryMarkdownFromFetched(
      fetched,
      answers,
      dorData,
      testabilityData,
      launch.mergedEnv
    );
    fs.writeFileSync(summaryPath, summaryMd, 'utf8');

    console.log('RESULT:dor-ok');
    res.writeHead(200); res.end('ok');
    return;
  }

  // ── Working-summary — progress bar while agent builds summary ────────────
  if (url === '/working-summary') {
    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + CSS + '</style>'
      + '<style>'
      + '.watermark{position:fixed;bottom:24px;right:24px;width:180px;opacity:0.08;pointer-events:none;z-index:0;}'
      + '.progress-wrap{width:100%;max-width:420px;margin:20px 0 6px;}'
      + '.progress-track{width:100%;height:10px;background:#dde3f0;border-radius:6px;overflow:hidden;}'
      + '.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#0052cc,#2684ff);'
      + 'border-radius:6px;transition:width 0.4s ease;}'
      + '.progress-pct{font-size:.85rem;color:#0052cc;font-weight:600;margin-top:6px;text-align:right;}'
      + '<\/style>'
      + '</head><body>'
      + '<img src="' + JIRA_LOGO + '" alt="" class="watermark" aria-hidden="true">'
      + '<div class="working">'
      + '<h2 id="status-text">Samenvatting wordt opgesteld\u2026</h2>'
      + '<div class="progress-wrap">'
      + '  <div class="progress-track"><div class="progress-fill" id="pbar"></div></div>'
      + '  <div class="progress-pct" id="pct">0%</div>'
      + '</div>'
      + '<p>Even geduld</p>'
      + '</div>'
      + '<script>'
      + 'var pv=0;'
      + 'var pb=document.getElementById("pbar");'
      + 'var pt=document.getElementById("pct");'
      + 'function setP(v){'
      + '  pv=v;'
      + '  pb.style.width=v.toFixed(1)+"%";'
      + '  pt.textContent=Math.round(v)+"%";'
      + '}'
      + 'function advance(){'
      + '  if(pv<92){'
      + '    var step=Math.max((92-pv)*0.025,0.08);'
      + '    setP(Math.min(pv+step,92));'
      + '  }'
      + '  setTimeout(advance,350);'
      + '}'
      + 'advance();'
      + 'function poll(){'
      + '  fetch("/summary-ready?ts="+Date.now(),{cache:"no-store"}).then(function(r){return r.json();})'
      + '  .then(function(d){'
      + '    if(d.ready){setP(100);setTimeout(function(){location.href="/summary";},400);}'
      + '    else{setTimeout(poll,1000);}'
      + '  })'
      + '  .catch(function(){setTimeout(poll,2000);});'
      + '}'
      + 'setTimeout(poll,800);'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Polled by /working to detect when jira-summary.md is written ─────────
  if (url === '/summary-ready') {
    const ready = fs.existsSync(summaryPath);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({ ready: ready }));
    return;
  }

  // ── Single-request status check (replaces 3 separate /dor-ready, /testability-ready, /summary-ready calls) ──
  if (url === '/status-all') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({
      fetched:     fs.existsSync(fetchedPath),
      fetchError:  fs.existsSync(fetchErrorPath),
      dor:         fs.existsSync(dorCheckPath),
      testability: fs.existsSync(testabilityCheckPath),
      summary:     fs.existsSync(summaryPath)
    }));
    return;
  }

  // ── Fetch-error — when MCP fetch fails, show immediate actionable message ──
  if (url === '/fetch-error') {
    var err = { code: 'unknown', message: 'Onbekende fout tijdens Jira-ophalen.', details: '' };
    try { err = JSON.parse(fs.readFileSync(fetchErrorPath, 'utf8')); } catch (_) {}

    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + SUMMARY_CSS + '</style></head><body>'
      + '<div class="top-header">'
      + '<img src="' + LOGO + '" class="logo" alt="Logo">'
      + '<div class="issue-header"><span class="issue-title">Jira ophalen mislukt</span></div>'
      + '</div>'
      + '<div style="background:#fff0ee;border-left:5px solid #de350b;border-radius:6px;padding:14px 18px;margin-bottom:20px;">'
      + '<p><strong>' + escHtml(err.message || 'Jira ophalen mislukt.') + '</strong></p>'
      + '<p style="margin-top:8px;"><strong>Code:</strong> ' + escHtml(err.code || 'unknown') + '</p>'
      + (err.details ? '<p style="margin-top:8px;"><strong>Details:</strong> ' + escHtml(err.details) + '</p>' : '')
      + '</div>'
      + '<p>Controleer MCP/Atlassian instellingen en probeer opnieuw.</p>'
      + '<div class="actions">'
      + '<button class="btn" onclick="location.href=\'/wizard\'">Opnieuw</button>'
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Fetch-result — renders jira-fetched.json with root + underlying item keys ──
  if (url === '/fetch-result') {
    var fetched = null;
    try { fetched = JSON.parse(fs.readFileSync(fetchedPath, 'utf8')); } catch (_) {
      res.writeHead(302, { Location: '/working' }); res.end(); return;
    }

    function pickRootIssue(data) {
      if (!data || typeof data !== 'object') return null;
      if (data.issue && typeof data.issue === 'object') return data.issue;
      if (data.rootIssue && typeof data.rootIssue === 'object') return data.rootIssue;
      if (data.jiraIssue && typeof data.jiraIssue === 'object') return data.jiraIssue;
      if (data.key || data.fields) return data;
      return null;
    }

    function getIssueKey(issue) {
      if (!issue || typeof issue !== 'object') return '';
      return String(issue.key || issue.issueKey || issue.id || '').trim();
    }

    function getIssueTitle(issue) {
      if (!issue || typeof issue !== 'object') return '';
      if (issue.fields && typeof issue.fields === 'object') {
        return String(issue.fields.summary || '').trim();
      }
      return String(issue.summary || issue.title || '').trim();
    }

    function extractAdfText(node) {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) {
        return node.map(extractAdfText).filter(Boolean).join('');
      }
      if (typeof node !== 'object') return '';

      if (node.type === 'text') {
        return String(node.text || '');
      }

      const content = Array.isArray(node.content) ? node.content : [];
      const inner = content.map(extractAdfText).join('');

      if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') {
        return inner + '\n';
      }
      if (node.type === 'hardBreak') {
        return '\n';
      }

      return inner;
    }

    function getIssueDescription(issue) {
      if (!issue || !issue.fields || typeof issue.fields !== 'object') return '';
      const d = issue.fields.description;
      if (!d) return '';
      if (typeof d === 'string') return d.trim();
      if (typeof d === 'object') return extractAdfText(d).replace(/\n{3,}/g, '\n\n').trim();
      return '';
    }

    function getIssueAttachments(issue) {
      if (!issue || !issue.fields || typeof issue.fields !== 'object') return [];
      const arr = issue.fields.attachment;
      return Array.isArray(arr) ? arr : [];
    }

    function pickChildIssues(data) {
      if (!data || typeof data !== 'object') return [];
      if (Array.isArray(data.childIssues)) return data.childIssues.filter(function(x) { return x && typeof x === 'object'; });
      if (Array.isArray(data.subIssues)) return data.subIssues.filter(function(x) { return x && typeof x === 'object'; });
      if (Array.isArray(data.underlyingIssues)) return data.underlyingIssues.filter(function(x) { return x && typeof x === 'object'; });
      return [];
    }

    var root = pickRootIssue(fetched) || {};
    var childIssues = pickChildIssues(fetched);
    var rootKey = getIssueKey(root);
    var rootTitle = getIssueTitle(root);
    var rootLabel = rootKey || 'Onbekend';
    if (rootTitle) {
      rootLabel += ' - ' + rootTitle;
    }

    var rootDescription = getIssueDescription(root);
    var rootDescriptionHtml = '<div style="margin-bottom:12px">'
      + '<div style="font-size:.82rem;font-weight:700;color:#666;letter-spacing:.01em;margin-bottom:6px;white-space:nowrap">Root item:</div>'
      + (rootDescription
        ? '<div style="white-space:pre-wrap;background:#f7f8fa;border:1px solid #dfe1e6;padding:12px;border-radius:8px;">' + escHtml(rootDescription) + '</div>'
        : '<p class="empty" style="margin:0">Geen beschrijving gevonden.</p>')
      + '</div>';

    var childDescriptions = [];
    for (var cd = 0; cd < childIssues.length; cd++) {
      var childIssue = childIssues[cd];
      var childDescription = getIssueDescription(childIssue);
      if (!childDescription) continue;
      var childKey = getIssueKey(childIssue);
      var childTitle = getIssueTitle(childIssue);
      var childLabel = childKey || 'Onbekend';
      if (childTitle) childLabel += ' - ' + childTitle;
      childDescriptions.push(
        '<div style="margin-bottom:12px">'
        + '<div style="font-size:.82rem;font-weight:700;color:#666;letter-spacing:.01em;margin-bottom:6px;white-space:normal;overflow-wrap:anywhere;word-break:break-word">Sub item: ' + escHtml(childLabel) + '</div>'
        + '<div style="white-space:pre-wrap;background:#f7f8fa;border:1px solid #dfe1e6;padding:12px;border-radius:8px;">' + escHtml(childDescription) + '</div>'
        + '</div>'
      );
    }

    var descriptionHtml = rootDescriptionHtml + (childDescriptions.length ? childDescriptions.join('') : '');

    var childItemsInOpgehaaldHtml = childIssues.length
      ? '<div style="display:flex;flex-direction:column;gap:4px">' + childIssues.map(function(issue) {
        var key = getIssueKey(issue);
        var title = getIssueTitle(issue);
        var label = key || 'Onbekend';
        if (title) label += ' - ' + title;
        return '<div>' + escHtml(label) + '</div>';
      }).join('') + '</div>'
      : '<span class="empty">Geen sub-items gevonden.</span>';

    var attachmentRows = [];
    var allIssues = [root].concat(childIssues);
    for (var i = 0; i < allIssues.length; i++) {
      var issue = allIssues[i];
      var issueKey = getIssueKey(issue);
      var issueTitle = getIssueTitle(issue);
      var issueLabel = issueKey || 'Onbekend';
      if (issueTitle) issueLabel += ' - ' + issueTitle;
      var issueAttachments = getIssueAttachments(issue);
      for (var j = 0; j < issueAttachments.length; j++) {
        var a = issueAttachments[j];
        attachmentRows.push({
          issueKey: issueKey,
          issueTitle: issueTitle,
          issueLabel: issueLabel,
          fileName: String((a && (a.filename || a.name)) || 'Onbekende bijlage'),
          attachmentId: String((a && (a.id || a.attachmentId)) || ''),
          contentUrl: String((a && (a.content || a.url)) || ''),
          mimeType: String((a && (a.mimeType || a.mimetype)) || '')
        });
      }
    }

    var attachmentsHtml = attachmentRows.length
      ? '<ul>' + attachmentRows.map(function(row, idx) {
        return '<li style="display:flex;align-items:flex-start;gap:10px;">'
          + '<input type="checkbox" class="att-inc" name="attachmentInclude" checked '
          + 'data-index="' + String(idx) + '" '
          + 'data-issue-key="' + escHtml(String(row.issueKey || '')) + '" '
          + 'data-issue-title="' + escHtml(String(row.issueTitle || '')) + '" '
          + 'data-id="' + escHtml(row.attachmentId) + '" '
          + 'data-content-url="' + escHtml(String(row.contentUrl || '')) + '" '
          + 'data-mime-type="' + escHtml(String(row.mimeType || '')) + '" '
          + 'data-filename="' + escHtml(row.fileName) + '">'
          + '<span>' + escHtml(row.issueLabel) + ' | ' + escHtml(row.fileName) + '</span>'
          + '</li>';
      }).join('') + '</ul>'
      : '<p class="empty">Geen bijlagen gevonden.</p>';

    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + SUMMARY_CSS + '</style></head><body>'
      + '<div class="top-header">'
      + '<img src="' + LOGO + '" class="logo" alt="Logo">'
      + '<div class="issue-header">'
      + (rootKey ? '<span class="badge">' + escHtml(rootKey) + '</span>' : '')
      + '<span class="issue-title">' + escHtml(rootTitle || 'Jira item opgehaald') + '</span>'
      + '</div></div>'
      + '<h2>Opgehaald</h2>'
      + '<div class="h-item" style="display:flex;align-items:flex-start;gap:6px;white-space:normal;overflow:visible">'
      + '<span style="font-size:.82rem;font-weight:700;color:#666;letter-spacing:.01em;white-space:nowrap">Root item:</span>'
      + '<span class="h-value" style="flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere;word-break:break-word">' + escHtml(rootLabel) + '</span>'
      + '</div>'
      + '<div class="h-item" style="display:flex;align-items:flex-start;gap:6px;white-space:normal;overflow:visible">'
      + '<span style="font-size:.82rem;font-weight:700;color:#666;letter-spacing:.01em;white-space:nowrap">Sub item(s):</span>'
      + '<span class="h-value" style="flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere;word-break:break-word">' + childItemsInOpgehaaldHtml + '</span>'
      + '</div>'
      + '<h2>Beschrijving</h2>'
      + descriptionHtml
      + '<h2>Bijlagen</h2>'
      + attachmentsHtml
      + '<div class="actions">'
      + '<button class="btn" id="btnOk" onclick="bevestig()">Analyseren</button>'
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '<script>'
      + 'function bevestig(){'
      + '  document.getElementById("btnOk").disabled=true;'
      + '  document.getElementById("btnOk").textContent="Bezig\u2026";'
      + '  var selected = Array.prototype.slice.call(document.querySelectorAll("input[name=attachmentInclude]")).map(function(el){'
      + '    return {'
      + '      index: Number(el.getAttribute("data-index") || 0),'
      + '      issueKey: el.getAttribute("data-issue-key") || "",'
      + '      issueTitle: el.getAttribute("data-issue-title") || "",'
      + '      id: el.getAttribute("data-id") || "",'
      + '      contentUrl: el.getAttribute("data-content-url") || "",'
      + '      mimeType: el.getAttribute("data-mime-type") || "",'
      + '      filename: el.getAttribute("data-filename") || "",'
      + '      include: !!el.checked'
      + '    };'
      + '  });'
      + '  fetch("/bevestigen", {'
      + '    method: "POST",'
      + '    headers: {"Content-Type":"application/json"},'
      + '    body: JSON.stringify({ selectedAttachments: selected })'
      + '  }).then(function(r){return r.json();}).then(function(r){'
      + '    location.href=(r&&r.next)?r.next:"/pre-check";'
      + '  }).catch(function(){'
      + '    location.href="/pre-check";'
      + '  });'
      + '}'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Summary — renders jira-summary.md ────────────────────────────────────
  if (url === '/summary') {
    let md = '';
    try { md = fs.readFileSync(summaryPath, 'utf8'); } catch (_) {
      res.writeHead(302, { Location: '/working' }); res.end(); return;
    }

    // Extract issue key and title from first H1 line (e.g. "# RB-5656 — Titel")
    var titleMatch = md.match(/^#\s+(.+)$/m);
    var fullTitle  = titleMatch ? titleMatch[1].trim() : 'Jira Samenvatting';
    var keyMatch   = fullTitle.match(/^([A-Z]+-\d+)/);
    var issueKey   = keyMatch ? keyMatch[1] : '';
    var issueTitle = keyMatch
      ? fullTitle.replace(issueKey, '').replace(/^\s*[\u2014\-]\s*/, '').trim()
      : fullTitle;

    var logoHtml = '<img src="' + LOGO + '" class="logo" alt="Logo">';
    var bodyHtml = mdToHtmlSummary(md);

    var confirmState = { confirmed: false };
    try { confirmState = JSON.parse(fs.readFileSync(summaryConfirmedPath, 'utf8')); } catch (_) {}
    var isConfirmed = !!(confirmState && confirmState.confirmed);
    var confirmedAt = String(confirmState && confirmState.confirmedAt || '').trim();
    var confirmedFile = String(confirmState && confirmState.savedFile || '').trim();
    var confirmBanner = '';
    if (isConfirmed) {
      confirmBanner = '<div style="background:#f0faf4;border:1px solid #b7ebc6;border-radius:8px;'
        + 'padding:12px 16px;margin-bottom:20px;color:#1f6f43;font-size:.9rem;">'
        + '&#10003;&nbsp; Samenvatting opgeslagen op ' + escHtml(confirmedAt || 'onbekend tijdstip')
        + (confirmedFile ? ('<br><span style="font-size:.82rem;color:#4b5;">Bestand: ' + escHtml(confirmedFile) + '</span>') : '')
        + '</div>';
    }

    // Unchanged banner — shown if the Analyse section states nothing changed since the last harvest
    var unchangedBanner = '';
    var unchangedMatch = md.match(/Geen wijzigingen vastgesteld sinds de vorige harvest op ([^.\n]+)\./);
    if (unchangedMatch) {
      unchangedBanner = '<div style="background:#f0faf4;border:1px solid #b7ebc6;border-radius:8px;'
        + 'padding:12px 16px;margin-bottom:20px;color:#1f6f43;font-size:.9rem;">'
        + '&#10003;&nbsp; Geen wijzigingen vastgesteld sinds de vorige harvest op ' + escHtml(unchangedMatch[1]) + '.</div>';
    }

    // DoR warning — fail-safe: also warn when check data is missing/unreadable.
    var dorWarningHtml = '';
    var dorKnown = false;
    var dorFailed = true;
    try {
      var dorData = JSON.parse(fs.readFileSync(dorCheckPath, 'utf8'));
      dorKnown = true;
      dorFailed = !dorData.allPassed;
    } catch (_) {}
    if (dorFailed) {
      dorWarningHtml = '<div style="background:#fff0ee;border-left:5px solid #de350b;'
        + 'border-radius:6px;padding:14px 18px;margin-bottom:24px;">'
        + '<strong style="color:#de350b;font-size:1rem;">'
        + '⚠️&nbsp; Dit item voldoet niet aan alle DoR-criteria. '
        + 'Controleer de vereisten voordat je verdergaat met het opstellen van testscripts.'
        + '</strong>'
        + (!dorKnown ? '<div style="margin-top:8px;color:#6b778c;font-size:.88rem;">DoR-statusbestand ontbreekt; waarschuwing wordt uit voorzorg getoond.</div>' : '')
        + '</div>';
    }

    // Testability warning — fail-safe: also warn when check data is missing/unreadable.
    var testabilityWarningHtml = '';
    var testabilityKnown = false;
    var testabilityFailed = true;
    try {
      var testData = JSON.parse(fs.readFileSync(testabilityCheckPath, 'utf8'));
      testabilityKnown = true;
      testabilityFailed = !testData.isTestable;
    } catch (_) {}
    if (testabilityFailed) {
      testabilityWarningHtml = '<div style="background:#fff0ee;border-left:5px solid #de350b;'
        + 'border-radius:6px;padding:14px 18px;margin-bottom:24px;">'
        + '<strong style="color:#de350b;font-size:1rem;">'
        + '⚠️&nbsp; Dit item is (nog) niet testbaar. '
        + 'Er is onvoldoende informatie beschikbaar om testscenario&#39;s op te stellen.'
        + '</strong>'
        + (!testabilityKnown ? '<div style="margin-top:8px;color:#6b778c;font-size:.88rem;">Testability-statusbestand ontbreekt; waarschuwing wordt uit voorzorg getoond.</div>' : '')
        + '</div>';
    }

    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + SUMMARY_CSS + '</style></head><body>'
      + '<div class="top-header">'
      + logoHtml
      + '<div class="issue-header">'
      + (issueKey ? '<span class="badge">' + escHtml(issueKey) + '</span>' : '')
      + '<span class="issue-title">' + escHtml(issueTitle) + '</span>'
      + '</div>'
      + '</div>'
      + unchangedBanner
        + confirmBanner
      + dorWarningHtml
      + testabilityWarningHtml
      + bodyHtml
      + '<div class="actions">'
        + (isConfirmed
          ? '<button class="btn" id="btnContinue" onclick="doorgaan()">Doorgaan</button>'
          : '<button class="btn" id="btnOk" onclick="bevestig()">Bevestigen</button>')
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '<script>'
      + 'function bevestig(){'
      + '  document.getElementById("btnOk").disabled=true;'
      + '  document.getElementById("btnOk").textContent="Bezig\u2026";'
        + '  fetch("/bevestigen").then(function(){'
        + '    location.href="/summary";'
        + '  });'
        + '}'
        + 'function doorgaan(){'
        + '  var b=document.getElementById("btnContinue");'
        + '  if(b){b.disabled=true;b.textContent="Bezig\u2026";}'
        + '  fetch("/summary-continue",{method:"POST"}).then(function(){'
      + '    document.body.innerHTML=\'<div style="text-align:center;padding:80px 24px">\'+'
      + '\'<h2 style="color:#0052cc">Samenvatting bevestigd!</h2>\'+'
      + '\'<p style="color:#666">Harvest is afgerond. Je kunt nu terug naar VS Code.</p></div>\';'
      + '  });'
      + '}'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── User confirms the summary ─────────────────────────────────────────────
  if (url === '/bevestigen') {
    // Re-write answers JSON with selected attachments and harvest file path for downstream use.
    let answers = {};
    try { answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')); } catch (_) {}
    if (req.method === 'POST') {
      try {
        const rawBody = await readBody(req);
        if (rawBody) {
          const payload = JSON.parse(rawBody);
          if (payload && Array.isArray(payload.selectedAttachments)) {
            answers.selectedAttachments = payload.selectedAttachments.map(function(item) {
              return {
                index: Number(item && item.index || 0),
                issueKey: String(item && item.issueKey || ''),
                issueTitle: String(item && item.issueTitle || ''),
                id: String(item && item.id || ''),
                contentUrl: String(item && item.contentUrl || ''),
                mimeType: String(item && item.mimeType || ''),
                filename: String(item && item.filename || ''),
                include: !!(item && item.include)
              };
            });
          }
        }
      } catch (_) {}

      const confirmedKeyPost = answers.jiraKey || '';
      if (confirmedKeyPost) {
        answers.harvestFile = path.join(WORKSPACE, '01-Harvest-Jira-Summaries', 'harvest-' + confirmedKeyPost + '.md');
      }
      fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2), 'utf8');

      // Step 1 after Analyze: evaluate Jira input against Definition of Ready (DoR) guidance.
      let fetched = {};
      try { fetched = JSON.parse(fs.readFileSync(fetchedPath, 'utf8')); } catch (_) {}
      const health = getMcpConfigHealth();
      const launch = health.launch;
      launch.mergedEnv = buildMcpEnv(launch.env);
      const dorData = await buildDorCheckFromFetched(fetched, answers.selectedAttachments || [], launch.mergedEnv);
      fs.writeFileSync(dorCheckPath, JSON.stringify(dorData, null, 2), 'utf8');
      const testabilityData = await buildTestabilityCheckFromFetched(fetched, answers.selectedAttachments || [], launch.mergedEnv);
      fs.writeFileSync(testabilityCheckPath, JSON.stringify(testabilityData, null, 2), 'utf8');

      console.log('RESULT:analyse-started');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, next: '/pre-check' }));
      return;
    }

    fs.writeFileSync(actionPath, 'bevestigd', 'utf8');

    const confirmedKey = answers.jiraKey || '';
    const now = new Date();
    const saveDisplay = buildSummaryTimestampForDisplay(now);
    const summariesDir = path.join(WORKSPACE, '01-Harvest-Jira-Summaries');
    const safeKey = confirmedKey || 'ONBEKEND';
    const mdTargetFile = path.join(summariesDir, 'harvest-' + safeKey + '.md');
    const metaTargetFile = path.join(summariesDir, 'harvest-' + safeKey + '.meta.json');

    try { fs.mkdirSync(summariesDir, { recursive: true }); } catch (_) {}

    let currentSummary = '';
    try { currentSummary = fs.readFileSync(summaryPath, 'utf8'); } catch (_) { currentSummary = ''; }
    fs.writeFileSync(mdTargetFile, currentSummary, 'utf8');

    let fetched = {};
    try { fetched = JSON.parse(fs.readFileSync(fetchedPath, 'utf8')); } catch (_) {}
    const meta = buildHarvestMetaFromFetched(fetched);
    fs.writeFileSync(metaTargetFile, JSON.stringify(meta, null, 2), 'utf8');

    answers.harvestFile = mdTargetFile;
    fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2), 'utf8');

    const relTarget = path.relative(WORKSPACE, mdTargetFile).replace(/\\/g, '/');
    const confirmState = {
      confirmed: true,
      confirmedAt: saveDisplay,
      savedFile: relTarget
    };
    fs.writeFileSync(summaryConfirmedPath, JSON.stringify(confirmState, null, 2), 'utf8');

    if (confirmedKey) {
      answers.harvestFile = mdTargetFile;
      fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2), 'utf8');
    }

    console.log('CONFIRMED:ok');

    res.writeHead(200); res.end('ok');
    return;
  }

  if (url === '/summary-continue' && req.method === 'POST') {
    fs.writeFileSync(actionPath, 'bevestigd', 'utf8');
    console.log('RESULT:summary-continue');
    res.writeHead(200); res.end('ok');
    return;
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  if (url === '/cancel') {
    fs.writeFileSync(actionPath, 'cancelled', 'utf8');
    try { if (fs.existsSync(warningPath)) fs.unlinkSync(warningPath); } catch(_){}
    console.log('RESULT:cancelled');

    // Close the Chrome window from the server side after a short delay,
    // so the browser has time to render the farewell page first.
    setTimeout(function() {
      cp.exec(
        'powershell -NoProfile -NonInteractive -Command "'
        + 'Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force"'
      );
    }, 1200);

    const html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">'
      + '<style>' + CSS + '</style></head><body>'
      + '<div style="text-align:center;padding:80px 24px">'
      + '<h2 style="color:#0052cc;margin-bottom:12px">Sessie be&euml;indigd</h2>'
      + '<p style="color:#666">Het proces is gestopt. Dit venster wordt gesloten.</p>'
      + '</div>'
      // JS close attempts — belt-and-suspenders
      + '<script>'
      + 'function tryClose(){'
      + '  try{window.open("","_self","");window.close();}catch(_){}'
      + '  try{window.close();}catch(_){}'
      + '}'
      + 'setTimeout(tryClose, 800);'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Existing-check — polled by /working to detect overwrite warning ──────
  if (url === '/existing-check') {
    var warn = false; var wKey = '';
    if (fs.existsSync(warningPath)) {
      try { var w = JSON.parse(fs.readFileSync(warningPath,'utf8')); wKey = w.jiraKey||''; warn=true; } catch(_){}
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({warn:warn,jiraKey:wKey}));
    return;
  }

  // ── Existing-warning — Dutch confirmation page ─────────────────────────
  if (url === '/existing-warning') {
    var wJiraKey = ''; var wHarvestedAt = '';
    try { var wf = JSON.parse(fs.readFileSync(warningPath,'utf8')); wJiraKey = wf.jiraKey||''; wHarvestedAt = wf.harvestedAt||''; } catch(_){}
    var harvestDateStr = '';
    if (wHarvestedAt) {
      try {
        var d = new Date(wHarvestedAt);
        harvestDateStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
          + ' om ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      } catch(_) {}
    }
    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + CSS + '</style>'
      + '<style>'
      + '.warn-box{max-width:520px;margin:80px auto;padding:32px 28px;background:#fff;border-radius:10px;'
      + 'box-shadow:0 2px 16px rgba(0,0,0,.12);text-align:center;}'
      + '.warn-box h2{color:#0052cc;margin:0 0 16px;}'
      + '.warn-box p{color:#444;margin:0 0 12px;line-height:1.5;}'
      + '.warn-key{display:inline-block;background:#e8f0fe;color:#0052cc;font-weight:700;'
      + 'padding:3px 10px;border-radius:4px;font-size:1rem;margin:0 4px;}'
      + '.warn-date{font-size:.85rem;color:#888;margin:4px 0 16px;}'
      + '.warn-actions{display:flex;gap:12px;justify-content:center;margin-top:24px;}'
      + '<\/style>'
      + '</head><body>'
      + '<div class="warn-box">'
      + '<h2>Bestaand bestand gevonden</h2>'
      + '<p>Er bestaat al een samenvatting voor <span class="warn-key">' + escHtml(wJiraKey) + '</span>.</p>'
      + (harvestDateStr ? '<p class="warn-date">Laatste harvest: ' + escHtml(harvestDateStr) + '</p>' : '')
      + '<p>Wil je doorgaan en de samenvatting bijwerken met de laatste Jira-gegevens?</p>'
      + '<div class="warn-actions">'
      + '<button class="btn" id="btnJa" onclick="doorgaan()">Bijwerken</button>'
      + '<button class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '</div>'
      + '<script>'
      + 'function doorgaan(){'
      + '  document.getElementById("btnJa").disabled=true;'
      + '  document.getElementById("btnJa").textContent="Bezig\u2026";'
      + '  fetch("/confirm-overwrite",{method:"POST"})'
      + '  .then(function(){location.href="/working";});'
      + '}'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Confirm overwrite — user chose Ja ──────────────────────────────────
  if (url === '/confirm-overwrite' && req.method === 'POST') {
    try { fs.unlinkSync(warningPath); } catch(_){}
    console.log('RESULT:doorgaan');
    res.writeHead(200); res.end('ok');
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', function() {
  const health = getMcpConfigHealth();
  if (!health.isHealthy) {
    const msg = health.unresolvedInputs.length
      ? 'MCP health-check: unresolved placeholders in .vscode/mcp.json -> ' + health.unresolvedInputs.join(', ')
      : 'MCP health-check: missing values in .vscode/mcp.json -> ' + health.missingValues.join(', ');
    console.log(msg);
  }
  console.log('Wizard listening on http://127.0.0.1:' + PORT);
  openChrome('http://127.0.0.1:' + PORT + '/splash');
});
