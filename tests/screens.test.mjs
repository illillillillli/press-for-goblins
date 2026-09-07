import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../dashboard.html', import.meta.url), 'utf8');
const worldglassSource = await readFile(new URL('../assets/worldglass/worldglass.js', import.meta.url), 'utf8');
const worldglassStyles = await readFile(new URL('../assets/worldglass/worldglass.css', import.meta.url), 'utf8');

const screenIds = [
  'screen-hero',
  'screen-term',
  'screen-receipt',
  'screen-about',
  'screen-portfolio',
];

function openingTag(id) {
  const match = source.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`));
  assert.ok(match, `missing opening tag for ${id}`);
  return match[0];
}

test('all executable inline scripts parse', () => {
  for (const [name, html] of [['site', source], ['dashboard', dashboardSource]]) {
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(match => !/type=["']application\/ld\+json["']/i.test(match[1]))
      .map(match => match[2]);
    assert.ok(scripts.length, `${name} has no executable script`);
    scripts.forEach((script, index) => assert.doesNotThrow(() => new Function(script), `${name} script ${index + 1} must parse`));
  }
});

test('search and social descriptions use the approved company introduction', () => {
  const description = 'A narrative studio for writers, comic creators, game developers, publishers and the occasional unknown entity.';
  assert.equal((source.match(new RegExp(description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 5);
  assert.match(source, new RegExp(`<meta name="description"\\s+content="${description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
  assert.match(source, new RegExp(`<meta property="og:description"\\s+content="${description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
  assert.match(source, new RegExp(`<meta name="twitter:description"\\s+content="${description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
});

test('initial screen markup is isolated before JavaScript runs', () => {
  const hero = openingTag('screen-hero');
  assert.match(hero, /class="screen is-active"/);
  assert.match(hero, /aria-hidden="false"/);
  assert.doesNotMatch(hero, /\sinert(?:\s|>)/);

  for (const id of screenIds.filter(id => id !== 'screen-hero')) {
    const tag = openingTag(id);
    assert.match(tag, /aria-hidden="true"/, `${id} must begin hidden from assistive technology`);
    assert.match(tag, /\sinert(?:\s|>)/, `${id} must begin inert`);
    assert.match(tag, /tabindex="-1"/, `${id} needs a non-tabbing context focus target`);
  }
});

test('one screen-state owner controls visibility, interactivity and focus', () => {
  assert.match(source, /function setActiveScreenState\(id, options\)/);
  assert.match(source, /target\.inert = false/);
  assert.match(source, /screen\.inert = true/);
  assert.match(source, /focusedScreen && focusedScreen !== target/);
  assert.match(source, /screen\.focus\(\{ preventScroll: true \}\)/);

  assert.equal((source.match(/classList\.add\('is-active'\)/g) || []).length, 1);
  assert.equal((source.match(/classList\.remove\('is-active'\)/g) || []).length, 1);
  assert.match(source, /function activateScreen\(id, options\) \{\s*return window\._setActiveScreenState\(id, options\);/);
  assert.match(source, /function showScreen\(name, options\) \{[\s\S]*?return window\._setActiveScreenState\(screens\[name\]\.id, options\);/);
});

test('flow entry and receipt transitions request contextual focus without targeting an input', () => {
  assert.match(source, /showScreen\('term', \{ focus: 'context' \}\)/);
  assert.ok(
    (source.match(/showScreen\('receipt', \{ focus: 'context' \}\)/g) || []).length >= 2,
    'receipt entry paths must request contextual focus',
  );
  assert.doesNotMatch(source, /focusScreenContext[\s\S]{0,500}querySelector\(['"](?:input|textarea)/);
});

test('principal views share one physical heading and divider at every viewport', () => {
  assert.equal((source.match(/<h1\b/g) || []).length, 1, 'principal views must not duplicate headings');
  assert.equal((source.match(/<span class="principal-divider"/g) || []).length, 1);
  assert.equal((source.match(/class="principal-header-slot"/g) || []).length, 3);
  assert.doesNotMatch(source, /id="(?:home|about|port)-title"/);
  assert.match(source, /\.principal-header-slot\s*\{[\s\S]*?display:\s*block/);
  assert.doesNotMatch(source, /@media \(min-width:\s*601px\)[\s\S]{0,300}\.principal-header-slot\s*\{[\s\S]{0,100}display:\s*none/);
  assert.match(source, /var el = document\.getElementById\('principal-title'\)/);
  assert.match(source, /document\.addEventListener\('principalTitleChanged', fitTitle\)/);
});

test('principal tab changes are atomic and use the settled opening cadence everywhere', () => {
  assert.match(source, /\.screen\s*\{[\s\S]*?transition:\s*none/);
  assert.doesNotMatch(source, /MOBILE_HERO_INTRO/);
  assert.match(source, /const HERO_READY_MS = 1500/);
  assert.match(source, /const HERO_CORRECTION_MS = 2800/);
  assert.match(source, /eyes\[0\]\.classList\.add\('open'\)/);
  assert.match(source, /setTimeout\(\(\) => eyes\[1\]\.classList\.add\('open'\), 220\)/);
  assert.match(source, /setTimeout\(\(\) => eyes\[2\]\.classList\.add\('open'\), 440\)/);
});

test('homepage identifies Noah and corrects singular studio ownership to the collective', () => {
  assert.match(source, /--green:\s*#74c58d/);
  assert.doesNotMatch(source, /#72d087|#89ce8d|#c5fac8|#7bbf7b/);
  assert.match(source, /yes, hello\. this is noah grey\./);
  assert.doesNotMatch(source, /the human one|shifting height/);
  assert.match(source, /<span\s+class="we-text">i<\/span>/);
  assert.match(source, /class="we-hand-letter we-hand-w"/);
  assert.match(source, /class="we-hand-letter we-hand-e"/);
  assert.match(source, /const correctionLetters = Array\.from\(newSubjectEl\.querySelectorAll\('\.we-hand-letter'\)\)/);
  assert.match(source, /correctionLetters\.forEach\(\(letter, letterIndex\) => \{/);
  assert.match(source, /strokes\.forEach\(\(path, strokeIndex\) => \{/);
  assert.match(source, /Math\.round\(620 \* \(lengths\[strokeIndex\] \/ letterLength\)\)/);
  assert.match(source, /if \(strokeIndex < strokes\.length - 1\) penAt \+= 45/);
  assert.match(source, /if \(letterIndex < correctionLetters\.length - 1\) penAt \+= letterIndex === 1 \? 130 : 70/);
  assert.doesNotMatch(source, /async function runCorrection|correctionHold|correctionRun/);
  assert.doesNotMatch(source, /newSubjectEl\.animate\(\[\{ opacity: 0 \}/);
  assert.match(source, /viewBox="0 0 165 72" width="32" height="14"/);
  assert.match(source, /#new-subject\s*\{[\s\S]{0,120}?width:\s*0;[\s\S]{0,120}?overflow:\s*hidden/);
  assert.match(source, /--goblin-pencil-green:\s*var\(--green\)/);
  assert.match(source, /--goblin-pencil-width:\s*1\.25px/);
  assert.match(source, /\.goblin-pencil-stroke\s*\{[\s\S]{0,240}?vector-effect:\s*non-scaling-stroke/);
  assert.match(source, /<path d="M0 4 Q15 3\.8,26 4 Q28 3,30 2\.5" fill="none" stroke="var\(--green\)"/);
  assert.match(source, /#strikethrough-svg\s*\{[\s\S]{0,180}?width:\s*calc\(100% \+ 6px\)/);
  assert.doesNotMatch(source, /<path class="goblin-pencil-stroke" d="M0 4 Q15/);
  assert.match(source, /\[\{ width: '0px', marginRight: '0px' \}, \{ width: '38px', marginRight: '-4px' \}\]/);
  assert.match(source, /duration: 950, delay: 1400, easing: 'cubic-bezier\(0\.22,0\.55,0\.35,1\)'/);
  assert.equal((source.match(/newSubjectEl\.animate\(/g) || []).length, 1);
  assert.match(source, /newSubjectEl\.style\.width = '0px'/);
  assert.match(source, /newSubjectEl\.style\.width = '38px'/);
  assert.match(source, /newSubjectEl\.style\.marginRight = '0px'/);
  assert.match(source, /newSubjectEl\.style\.marginRight = '-4px'/);
  assert.doesNotMatch(source, /letter\.style\.transform = `translate\(|570 \+ Math\.random/);
  assert.doesNotMatch(source, /hero\.classList\.remove\('ready'\);\s*settleCorrection\(\)/);
  assert.doesNotMatch(source, /we-hand-e[\s\S]{0,1800}setTimeout\(\(\) => node\.animate/);
  assert.match(source, /<\/svg><\/span><span class="sr-only">we<\/span> run a narrative studio/);
  assert.match(source, /the word “we” is a handwritten correction to “i”\./);
});

test('email runes decode on deliberate activation, remain readable, then open the mail app', () => {
  assert.doesNotMatch(source, /link\.addEventListener\('pointerenter', beginEmailHoverDecode\)/);
  assert.doesNotMatch(source, /link\.addEventListener\('focus', beginEmailHoverDecode\)/);
  assert.match(source, /emailHoverReturnTimer = setTimeout\([\s\S]{0,700}?}, 7000\)/);
  assert.match(source, /link\.addEventListener\('click', function \(e\)/);
  assert.match(source, /if \(emailHoverDecoded\) \{[\s\S]{0,220}?link\.href = 'mailto:' \+ rot13\(_ER\);[\s\S]{0,80}?return;/);
  assert.match(source, /latinEl\.setAttribute\('fill', GRAY\)/);
});

test('worldglass keeps every event stable, reactive and on the shared colour tokens', () => {
  assert.equal((worldglassSource.match(/\{ id: '[^']+', name:/g) || []).length, 8);
  assert.match(worldglassSource, /assignments = events\.slice\(0, limit\)\.map/);
  assert.match(worldglassSource, /button\._generation = \(button\._generation \|\| 0\) \+ 1/);
  assert.match(worldglassSource, /button\.classList\.add\('is-decoding'\)/);
  assert.match(worldglassSource, /button\.classList\.add\('is-decoded'\)/);
  assert.match(worldglassSource, /button\.addEventListener\('click', function \(event\)/);
  assert.match(worldglassSource, /function markerButtonAt\(clientX, clientY\)/);
  assert.match(worldglassSource, /function updateMarkerHover\(event\)/);
  assert.match(worldglassSource, /state\.event\.id === markerHoverId/);
  assert.match(worldglassSource, /context\.lineDashOffset = active/);
  assert.match(worldglassSource, /candidate\.distance <= 14/);
  assert.match(worldglassSource, /if \(markerButton\) activateLabel\(markerButton\)/);
  assert.match(worldglassSource, /nextDefaultZoom = width < 1100 \? 2\.05 : 1/);
  assert.match(worldglassSource, /zoom \/ defaultZoom/);
  assert.match(worldglassSource, /if \(event\.metaKey \|\| event\.ctrlKey\) return/);
  assert.match(worldglassSource, /function dockLayout\(\)/);
  assert.match(worldglassSource, /return events\.map\(function \(_, index\) \{\s*return \{ y: 0, side: index % 2 \? 'right' : 'left' \}/);
  assert.doesNotMatch(worldglassSource, /requestedShift = height \* \.035/);
  assert.match(worldglassSource, /viewportTop = viewport \? viewport\.offsetTop : 0/);
  assert.match(worldglassSource, /safeBottom = Math\.min\(/);
  assert.match(worldglassSource, /canvas\.style\.width = width \+ 'px'/);
  assert.match(worldglassSource, /fittedRadius = Math\.min\(\(width - 32\) \* \.5, \(safeBottom - safeTop\) \* \.5\)/);
  assert.match(worldglassSource, /visualViewport\.addEventListener\('resize', scheduleResize\)/);
  assert.match(worldglassSource, /new ResizeObserver\(scheduleResize\)\.observe\(root\)/);
  assert.match(worldglassSource, /dragThreshold = event\.pointerType === 'touch' \? 8 : 3/);
  assert.match(worldglassSource, /if \(moved && event\.detail !== 0\) return;[\s\S]{0,80}?activateLabel\(button\)/);
  assert.match(worldglassSource, /function pointerDown\(event\) \{\s*if \(event\.target\.closest\('button'\) && width >= 700\) return;/);
  assert.match(worldglassSource, /var mobileRecordBelt = \[/);
  assert.match(worldglassSource, /coordinate = width < 700 && mobileRecordBelt\[index\] \? mobileRecordBelt\[index\] : event/);
  assert.match(worldglassSource, /function positionMobileRecords\(states\) \{\s*if \(width >= 700 \|\| !lastMobileLayout\) return;/);
  assert.match(worldglassSource, /if \(state\.opacity <= \.01\)/);
  assert.match(worldglassSource, /positionMobileRecords\(states\)/);
  assert.match(worldglassSource, /var labelOpacity = width < 700 \? state\.opacity : \(state\.event\.id === selectedId \? 1 : state\.opacity\)/);
  assert.match(worldglassSource, /if \(moved && width < 700 && document\.activeElement && document\.activeElement\.closest\('\.worldglass-label'\)\)/);
  assert.match(worldglassSource, /button\.matches\(':hover, :focus'\)/);
  assert.match(worldglassStyles, /color: var\(--green, #74c58d\)/);
  assert.doesNotMatch(worldglassSource, /button\.style\.width = 'calc\('/);
  assert.doesNotMatch(worldglassStyles, /scaleX\(/);
  assert.match(worldglassSource, /leftInner: edgeInset \+ leftWidth/);
  assert.match(worldglassSource, /rightInner: width - edgeInset - rightWidth/);
  assert.match(worldglassStyles, /color: var\(--text-secondary, rgba\(255, 255, 255, \.55\)\)/);
  assert.match(worldglassStyles, /\.worldglass-label\.is-visible\.is-introduced\.is-interactive/);
  assert.match(worldglassStyles, /font: 25px\/1\.18/);
  assert.match(worldglassStyles, /width: \.6em;[\s\S]{0,80}?height: 1\.5em;[\s\S]{0,80}?flex: 0 0 \.6em;/);
  assert.match(worldglassStyles, /font: 400 \.84375em\/1/);
  assert.match(worldglassStyles, /stroke-width: 1\.05/);
  assert.match(worldglassStyles, /@media \(max-width: 700px\)[\s\S]*?font-size: 16px/);
  assert.match(worldglassStyles, /@media \(max-width: 700px\)[\s\S]*?touch-action: pinch-zoom/);
  assert.match(worldglassStyles, /@media \(max-width: 700px\)[\s\S]*?width: \.62em;[\s\S]*?flex-basis: \.62em;/);
  assert.match(worldglassStyles, /@media \(max-width: 700px\)[\s\S]*?\.worldglass-label\.rewind-in \{\s*animation-fill-mode: none;/);
  assert.match(worldglassSource, /worldglass-glyph-literal/);
  assert.match(worldglassSource, /\['#8c8c8c', '#fffccc', '#fdfd96'/);
  assert.match(worldglassSource, /button\._motionToken = \(button\._motionToken \|\| 0\) \+ 1/);
  assert.match(worldglassSource, /button\._reverseTimer = setTimeout/);
  assert.match(worldglassSource, /time - lastInteractionAt >= 5000/);
  assert.match(worldglassSource, /yaw \+= delta \* \.000018/);
  assert.match(worldglassSource, /function shimmerEncodedLabel\(\)/);
  assert.match(worldglassSource, /if \(!connectionsIntroducedAt/);
  assert.match(worldglassSource, /\(dockNodes\.length - 1\) \* 115 \+ 260/);
  assert.match(worldglassSource, /var count = 1 \+ Math\.floor\(Math\.random\(\) \* 3\)/);
});

test('principal headings begin below the fully opaque top mist at every viewport', () => {
  assert.match(source, /\.principal-title\s*\{[\s\S]{0,120}?color:\s*#fff;/);
  assert.doesNotMatch(source, /\.principal-title\s*\{[\s\S]{0,120}?color:\s*var\(--green\)/);
  assert.match(source, /transparent 155px,[\s\S]{0,300}#000 200px/);
  assert.match(source, /padding:\s*210px/);
  assert.match(source, /--mobile-mist-top-zero:\s*120px/);
  assert.match(source, /--mobile-mist-top-opaque:\s*140px/);
  assert.match(source, /padding-top:\s*calc\(var\(--mobile-mist-top-zero,[\s\S]{0,100}var\(--mobile-content-inset/);
});

test('the official portfolio surface loads worldglass', () => {
  assert.match(source, /href="assets\/worldglass\/worldglass\.css\?v=20260907-2"/);
  assert.match(source, /src="assets\/worldglass\/natural-earth-110m-land\.js\?v=20260906-4"/);
  assert.match(source, /src="assets\/worldglass\/worldglass\.js\?v=20260907-5"/);
  assert.match(source, /titleLines: \['worldglass', ''\]/);
  assert.match(source, /id="screen-portfolio"[^>]+aria-label="worldglass"/);
  assert.match(worldglassSource, /stack\.replaceWith\(root\)/);
  assert.doesNotMatch(worldglassSource, /navButton\.click\(\)/);
});

test('the retired field report deck keeps only the two reversible archive cards', () => {
  assert.doesNotMatch(source, /event\.log/);
  assert.match(source, /#screen-portfolio\s*\{[\s\S]{0,180}overflow-y:\s*hidden;[\s\S]{0,100}overscroll-behavior:\s*none;/);
  assert.equal((source.match(/class="field-report-card(?: is-active)?" data-report-id=/g) || []).length, 2);
  assert.match(source, /data-report-id="2026"[\s\S]{0,500}src="assets\/images\/2026-no-eyes\.png"/);
  assert.doesNotMatch(source, /data-report-id="goblin-reports"|port-email-input|port-signup-row/);
  assert.match(source, /data-report-id="goblins-x-author"[\s\S]{0,500}>author in conversation: \[redacted\]<\/h2>/);
  assert.doesNotMatch(source, /field-report-card-redacted/);
  assert.doesNotMatch(source, /field-report-card-status|field-report-card-meta/);
  assert.equal((source.match(/<button class="field-report-card-control" data-report-action="left"/g) || []).length, 2);
  assert.equal((source.match(/<button class="field-report-card-control" data-report-action="undo"/g) || []).length, 2);
  assert.equal((source.match(/<button class="field-report-card-control" data-report-action="pickup"/g) || []).length, 2);
  assert.equal((source.match(/<button class="field-report-card-control" data-report-action="right"/g) || []).length, 2);
  assert.match(source, /width:\s*min\(409px, calc\(72\.9svh - 386px\), calc\(72\.9vw - 47px\)\)/);
  assert.match(source, /width:\s*min\(67\.1vw, 379px, calc\(72\.9svh - 240px\)\)/);
  assert.match(source, /stroke-linecap:\s*butt/);
  assert.match(source, /stroke-linejoin:\s*miter/);
  assert.match(source, /function recordMovement\(index, mutate\)[\s\S]{0,220}before:[\s\S]{0,120}after:/);
  assert.match(source, /function undo\(\)[\s\S]{0,600}startTransform[\s\S]{0,600}targetTransform/);
  assert.match(source, /Math\.abs\(dx\) >= 54/);
  assert.match(source, /setPointerCapture\(event\.pointerId\)/);
  assert.match(source, /function compact\(\) \{ return matchMedia\('\(max-width: 900px\)'\)\.matches; \}/);
  assert.match(source, /startCardX = state\.cards\[index\]\.aside === 'free' \? state\.cards\[index\]\.x : startBase\.x/);
  assert.match(source, /state\.cards\[index\]\.x = startCardX \+ dx/);
  assert.match(source, /state\.cards\[index\]\.y = startCardY \+ dy/);
  assert.match(source, /\*, \*::before, \*::after\s*\{\s*cursor:\s*default !important/);
  assert.doesNotMatch(source, /fieldReportDrop|translateY\(-32px\)/);
  assert.match(source, /id="field-report-reading"[\s\S]{0,500}id="field-report-reading-put-down"/);
  assert.match(source, /duration:\s*520/);
  assert.match(source, /var faceChange = this\.ease/);
  assert.doesNotMatch(source, /var rotateY =|readingEdge/);
  assert.match(source, /\.field-report-reading-back\s*\{[\s\S]{0,120}padding:\s*22px 20px 66px/);
  assert.match(source, /sourceCenterX:\s*rect\.left \+ rect\.width \/ 2/);
  assert.match(source, /sourceCenterY:\s*rect\.top \+ rect\.height \/ 2/);
  assert.match(source, /var restingY = Math\.min\(48, innerHeight \* \.045\)/);
  assert.match(source, /var y = dy \* \(1 - motion\) \+ restingY \* motion/);
  assert.match(source, /session\.progress = Math\.max\(0, Math\.min\(1, session\.progress \+ direction \* elapsed \/ this\.duration\)\)/);
  assert.match(source, /clone\.removeAttribute\('id'\)/);
  assert.doesNotMatch(source, /classList\.add\('is-flipped'\)/);
  assert.match(source, /window\.addEventListener\('keydown'[\s\S]{0,260}event\.key !== 'Escape'[\s\S]{0,260}closeReport\(\)[\s\S]{0,40}true\);/);
  assert.doesNotMatch(source, /field-report-card-controls\.btn-glitch/);
  assert.doesNotMatch(source, /fieldReportInvitation/);
  assert.doesNotMatch(source, /scheduleControlGlitch/);
  assert.match(source, /undo:\s*\['M20 12 C20 7\.2 16\.5 3\.2 11\.5 3 C6\.5 2\.8 2\.5 7\.5 2\.2 12\.5 C2 17\.5 6\.2 21\.5 11\.2 21\.2'/);
  assert.match(source, /data-report-action="undo"\]\s+svg\s*\{[\s\S]{0,120}scale\(-1, -1\)/);
  assert.match(source, /left:\s*\['M26\.6 14 H1\.4', 'M7\.905 7\.495 L1\.4 14 L7\.905 20\.505'\]/);
  assert.match(source, /if \(!moved\)[\s\S]{0,220}openReport\(card\)/);
  assert.match(source, /despite centuries of bad press, we goblins can be fairly sociable/);
  assert.doesNotMatch(source, /port-email-input|isSignup|goblin-reports/);
  assert.doesNotMatch(source, /<p id="port-body-[12]"/);
});

test('Meet the Goblins alone owns the interactive social star field', () => {
  assert.match(source, /id="linkedin-ascii-link"/);
  assert.match(source, /id="ascii-output"/);
  assert.match(source, /\[ascii-linkedin\] interactive star field/);
  assert.match(source, /#linkedin-ascii-link\s*\{[\s\S]*?touch-action:\s*none/);
  assert.match(source, /#linkedin-ascii-link\.is-unlocked\s*\{\s*touch-action:\s*manipulation/);
  assert.match(source, /var REVEALED_KEY = 'pfg-linkedin-revealed'/);
  assert.match(source, /pfgDashboardEnabled\(\).*sessionStorage\.setItem\(REVEALED_KEY, '1'\)/);
  assert.match(source, /pfgDashboardEnabled\(\).*sessionStorage\.getItem\(REVEALED_KEY\) === '1'/);
  assert.match(source, /link\.addEventListener\('touchstart',[\s\S]{0,100}if \(allRevealed\) return/);
  assert.match(source, /#about-social\s*\{\s*margin-top:\s*var\(--mobile-space-section\)/);
  assert.doesNotMatch(source, /instagram-ascii-link|ascii-output-insta|port-social/);
});

test('the mobile build keeps its approved design principle', () => {
  assert.match(source, /the mobile version is not the desktop version made smaller\. it has standards\./);
});

test('all free-text entry begins at the left inset', () => {
  assert.match(source, /\.term-input-field\s*\{[\s\S]*?text-align:\s*left/);
  assert.doesNotMatch(source, /#port-email-input/);
});

test('opportunities count only on their active screen and at least half inside the viewport', () => {
  assert.match(source, /function pfgOpportunityIsVisible\(element\)/);
  assert.match(source, /element\.closest\('\.screen'\)/);
  assert.match(source, /screen\.classList\.contains\('is-active'\)/);
  assert.match(source, /screen\.getAttribute\('aria-hidden'\) !== 'false'/);
  assert.match(source, /\(visibleWidth \* visibleHeight\) \/ area >= \.5/);
  assert.match(source, /activeScreenChanged'[\s\S]{0,100}pfgCheckVisibleOpportunities/);
});
