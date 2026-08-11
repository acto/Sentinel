# RB-8213 — Factureringsproces optimaliseren: verzamelfactuurverwerking loopt vast bij gelijktijdige belasting

## Status
**Aangemaakt:** 11-08-2026, 16:13:26

## Pre-check aandachtspunten (niet voldaan)
[DoR] Acceptatie Criteria:
	• Aanwezigheid: Ontbreekt
	• Format (Given/When/Then): Ontbreekt
[Testbaarheid] Testbasis aanwezig:
	• Geen duidelijke testbasis gevonden (user story, acceptance criteria, DoR/DoD of refinement-notes).
[Testbaarheid] Overkoepelend oordeel:
	• item is momenteel niet voldoende testbaar.

## Jira items overzicht
- Root item: RB-8213 - Factureringsproces optimaliseren: verzamelfactuurverwerking loopt vast bij gelijktijdige belasting
- Sub-item: RB-8224 - set-based maken create_invoice_proposal
- Sub-item: RB-8225 - Vanuit termijnfacturering de set-based aanroepen (Opdracht > aanneemsom)

## Overkoepelende samenvatting
- Door gebruik te maken van Virtual Users konden grote aantallen transacties reproduceerbaar worden uitgevoerd en kon gecontroleerd verhoogde belasting worden gecreëerd op de applicatie en database.
- Het doel van deze Virtual Users was het gecontroleerd genereren van grote aantallen transacties binnen een relatief korte periode.
- Het doel van deze tests was het gecontroleerd genereren van een hoge mate van gelijktijdigheid binnen specifieke bedrijfsprocessen.
- - De trigger controleert pas **ná** de insert of er dubbele codes zijn (`code_not_unique`-melding), in plaats
- De aanleiding voor deze test was een aanstaande livegang van een klant waarbij verwacht wordt dat circa 50 gelijktijdige gebruikers actief zullen zijn binnen de applicatie.
- Tijdens de evaluatie van de test zijn vragen ontstaan over de representativiteit van de gebruikte belasting, de inzet van AI-agents en het gebruik van geautomatiseerde Virtual Users.
- Binnen afzienbare tijd zal een KSH gaan op de ActoBusiness-omgeving waarbij verwacht wordt dat circa 50 gelijktijdige gebruikers actief zullen zijn binnen het systeem.
- Het primaire doel van de stresstest was vaststellen hoe ActoBusiness zich gedraagt onder een belasting die vergelijkbaar is met of hoger ligt dan de verwachte belasting van de toekomstige productieomgeving.
- Hoewel de toekomstige klant naar verwachting ongeveer 50 gelijktijdige gebruikers zal hebben, is tijdens deze stresstest bewust gekozen voor aanvullende geautomatiseerde belasting.
- De doelstelling was nadrukkelijk niet om exact 50 menselijke gebruikers te simuleren, maar om de applicatie te toetsen onder omstandigheden die gelijk zijn aan of zwaarder zijn dan de verwachte productiebelasting.
- Belasting is controleerbaar
- De Postman Virtual Users zijn niet ingezet om menselijk gedrag exact na te bootsen, maar om verhoogde belasting op specifieke bedrijfsprocessen te realiseren.
- | 2 | Stop met het synchroon bijwerken van `collective_invoice`-totalen tijdens opdracht-aanmaak; bereken ze on-demand (view/functie) bij opvragen/finaliseren — **specifiek gericht op cross-transactie concurrentie** (meerdere gebruikers, elk hun eigen transactie, tegelijk dezelfde debiteur); dit is niet hetzelfde probleem als §3.3 en wordt niet opgelost door #3.
- volledige SUM) lost dit niet op — de rij-lock op `collective_invoice` wordt in SQL Server pas vrijgegeven bij commit van de hele (buitenste) transactie, niet na de UPDATE-statement zelf, dus de rekenkosten van de update zijn hier niet het probleem | §3.2 | Verwijdert de schrijfactie (en dus de lock) op de gedeelde rij tijdens gelijktijdige *gebruikers*transacties volledig |
- Wanneer hierbij deadlocks, foutmeldingen of blokkeringen optreden, worden deze beschouwd als waardevolle testresultaten.
- Naast handmatige gebruikers en AI-agents zijn Postman Virtual Users ingezet op het relatie- en opdrachtenproces.
- Tijdens de stresstest zijn meerdere geautomatiseerde belastingtests uitgevoerd met behulp van Postman Virtual Users.
- De kracht van deze stresstest ligt in het feit dat meerdere onafhankelijke meetbronnen naar dezelfde oorzaak wijzen.
- Belasting → ERP-processen → Opdrachtketen → Facturatieketen → Lock-contentie → Deadlocks → Gebruikersimpact
- **Scope:** de keten `dbo.instruction` (opdracht) → `dbo.instruction_term` (termijnen) → `dbo.invoice_proposal`
- `create_invoice_proposal` is in elke herhaalde meting (4 onafhankelijke runs) steevast de zwaarste losse stap
- ### 3.1 Race condition op `instruction_code` / `instruction_term_code` (grootste risico)
- - Deze scope is **niet per debiteur**, maar per `system_company_id + system_administration_id` — dus alle
- `create_invoice_proposal` (§2) én versterkt het lock-probleem uit §3.2, omdat de verzamelfactuur-totalen dan

### Verdieping voor testontwerp
- Doel en scope-signalen:
  - Het doel van deze Virtual Users was het gecontroleerd genereren van grote aantallen transacties binnen een relatief korte periode.
  - Het doel van deze tests was het gecontroleerd genereren van een hoge mate van gelijktijdigheid binnen specifieke bedrijfsprocessen.
  - De aanleiding voor deze test was een aanstaande livegang van een klant waarbij verwacht wordt dat circa 50 gelijktijdige gebruikers actief zullen zijn binnen de applicatie.
  - Binnen afzienbare tijd zal een KSH gaan op de ActoBusiness-omgeving waarbij verwacht wordt dat circa 50 gelijktijdige gebruikers actief zullen zijn binnen het systeem.
  - Het primaire doel van de stresstest was vaststellen hoe ActoBusiness zich gedraagt onder een belasting die vergelijkbaar is met of hoger ligt dan de verwachte belasting van de toekomstige productieomgeving.
  - Hoewel de toekomstige klant naar verwachting ongeveer 50 gelijktijdige gebruikers zal hebben, is tijdens deze stresstest bewust gekozen voor aanvullende geautomatiseerde belasting.
  - De doelstelling was nadrukkelijk niet om exact 50 menselijke gebruikers te simuleren, maar om de applicatie te toetsen onder omstandigheden die gelijk zijn aan of zwaarder zijn dan de verwachte productiebelasting.
  - De Postman Virtual Users zijn niet ingezet om menselijk gedrag exact na te bootsen, maar om verhoogde belasting op specifieke bedrijfsprocessen te realiseren.
- Testdata en toegang:
  - Door gebruik te maken van Virtual Users konden grote aantallen transacties reproduceerbaar worden uitgevoerd en kon gecontroleerd verhoogde belasting worden gecreëerd op de applicatie en database.
  - Het doel van deze Virtual Users was het gecontroleerd genereren van grote aantallen transacties binnen een relatief korte periode.
  - Het doel van deze tests was het gecontroleerd genereren van een hoge mate van gelijktijdigheid binnen specifieke bedrijfsprocessen.
  - - De trigger controleert pas **ná** de insert of er dubbele codes zijn (`code_not_unique`-melding), in plaats
  - De aanleiding voor deze test was een aanstaande livegang van een klant waarbij verwacht wordt dat circa 50 gelijktijdige gebruikers actief zullen zijn binnen de applicatie.
  - Tijdens de evaluatie van de test zijn vragen ontstaan over de representativiteit van de gebruikte belasting, de inzet van AI-agents en het gebruik van geautomatiseerde Virtual Users.
  - Binnen afzienbare tijd zal een KSH gaan op de ActoBusiness-omgeving waarbij verwacht wordt dat circa 50 gelijktijdige gebruikers actief zullen zijn binnen het systeem.
  - Hoewel de toekomstige klant naar verwachting ongeveer 50 gelijktijdige gebruikers zal hebben, is tijdens deze stresstest bewust gekozen voor aanvullende geautomatiseerde belasting.
- Risico's en afhankelijkheden:
  - Wanneer hierbij deadlocks, foutmeldingen of blokkeringen optreden, worden deze beschouwd als waardevolle testresultaten.
  - De kracht van deze stresstest ligt in het feit dat meerdere onafhankelijke meetbronnen naar dezelfde oorzaak wijzen.
  - Belasting → ERP-processen → Opdrachtketen → Facturatieketen → Lock-contentie → Deadlocks → Gebruikersimpact
  - `create_invoice_proposal` is in elke herhaalde meting (4 onafhankelijke runs) steevast de zwaarste losse stap
  - ### 3.1 Race condition op `instruction_code` / `instruction_term_code` (grootste risico)
  - **Advies om mee te starten:** #1, omdat het de kleinste wijziging is met het grootste risico-reducerende
  - `create_invoice_proposal` zit; bij **gelijktijdig** gebruik is niet die snelheid het grootste risico, maar het
  - Gebruikers zien dan foutmeldingen en moeten hun actie opnieuw uitvoeren.

## Brondekking
- Beschrijvingen gebruikt: 1
- Opmerkingen gebruikt: 0
- Geselecteerde bijlagen: 2
- Bijlagen met tekstextract: 2
- Verwerkte bijlagen:
  - RB-8213 | Stress test rapport 22 juli  (v2).docx
  - RB-8213 | VERSLAG_PERFORMANCE_AANNEEMSOM_OPDRACHT.md
