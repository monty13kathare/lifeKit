/**
 * Demo dictionary rows: `english|hindi|spanish|french|german`.
 *
 * - Multi-word entries are phrases and are matched before single words.
 * - Rows whose English column starts with `~` are reverse-only aliases (e.g.
 *   Spanish "la" → English "the") and are never used when translating *from* English.
 * - An empty column means "omit" (e.g. Hindi has no article).
 * - Proper nouns keep their capitalisation (English days, German nouns).
 */
export const DICTIONARY_ROWS = `
hello|नमस्ते|hola|bonjour|hallo
hi|नमस्ते|hola|salut|hallo
good morning|सुप्रभात|buenos días|bonjour|guten Morgen
good afternoon|नमस्कार|buenas tardes|bon après-midi|guten Tag
good evening|शुभ संध्या|buenas tardes|bonsoir|guten Abend
good night|शुभ रात्रि|buenas noches|bonne nuit|gute Nacht
goodbye|अलविदा|adiós|au revoir|auf Wiedersehen
bye|अलविदा|adiós|salut|tschüss
see you later|फिर मिलेंगे|hasta luego|à plus tard|bis später
see you tomorrow|कल मिलेंगे|hasta mañana|à demain|bis morgen
see you soon|जल्द मिलेंगे|hasta pronto|à bientôt|bis bald
thank you very much|बहुत धन्यवाद|muchas gracias|merci beaucoup|vielen Dank
thank you|धन्यवाद|gracias|merci|danke
thanks|धन्यवाद|gracias|merci|danke
you're welcome|आपका स्वागत है|de nada|de rien|gern geschehen
please|कृपया|por favor|s'il vous plaît|bitte
sorry|माफ़ कीजिए|lo siento|désolé|Entschuldigung
excuse me|क्षमा कीजिए|disculpe|excusez-moi|entschuldigen Sie
how are you|आप कैसे हैं|cómo estás|comment allez-vous|wie geht es dir
and you|और आप|y tú|et vous|und du
i am fine|मैं ठीक हूँ|estoy bien|je vais bien|mir geht es gut
i'm fine|मैं ठीक हूँ|estoy bien|je vais bien|mir geht es gut
what is your name|आपका नाम क्या है|cómo te llamas|comment vous appelez-vous|wie heißt du
what's your name|आपका नाम क्या है|cómo te llamas|comment vous appelez-vous|wie heißt du
my name is|मेरा नाम है|me llamo|je m'appelle|ich heiße
nice to meet you|आपसे मिलकर खुशी हुई|mucho gusto|enchanté|freut mich
where are you from|आप कहाँ से हैं|de dónde eres|d'où venez-vous|woher kommst du
how old are you|आपकी उम्र क्या है|cuántos años tienes|quel âge avez-vous|wie alt bist du
i love you|मैं तुमसे प्यार करता हूँ|te quiero|je t'aime|ich liebe dich
i don't understand|मुझे समझ नहीं आया|no entiendo|je ne comprends pas|ich verstehe nicht
i do not understand|मुझे समझ नहीं आया|no entiendo|je ne comprends pas|ich verstehe nicht
i understand|मैं समझता हूँ|entiendo|je comprends|ich verstehe
i don't know|मुझे नहीं पता|no sé|je ne sais pas|ich weiß nicht
do you speak english|क्या आप अंग्रेज़ी बोलते हैं|hablas inglés|parlez-vous anglais|sprechen Sie Englisch
where is the bathroom|शौचालय कहाँ है|dónde está el baño|où sont les toilettes|wo ist die Toilette
where is|कहाँ है|dónde está|où est|wo ist
how much does it cost|इसकी कीमत क्या है|cuánto cuesta|combien ça coûte|wie viel kostet das
how much|कितना|cuánto|combien|wie viel
what time is it|कितने बजे हैं|qué hora es|quelle heure est-il|wie spät ist es
can you help me|क्या आप मेरी मदद कर सकते हैं|puedes ayudarme|pouvez-vous m'aider|kannst du mir helfen
help me|मेरी मदद करो|ayúdame|aidez-moi|hilf mir
i need help|मुझे मदद चाहिए|necesito ayuda|j'ai besoin d'aide|ich brauche Hilfe
call the police|पुलिस को बुलाओ|llame a la policía|appelez la police|rufen Sie die Polizei
i am lost|मैं खो गया हूँ|estoy perdido|je suis perdu|ich habe mich verirrt
the bill please|बिल दीजिए|la cuenta por favor|l'addition s'il vous plaît|die Rechnung bitte
of course|ज़रूर|por supuesto|bien sûr|natürlich
no problem|कोई बात नहीं|no hay problema|pas de problème|kein Problem
happy birthday|जन्मदिन मुबारक|feliz cumpleaños|joyeux anniversaire|alles Gute zum Geburtstag
good luck|शुभकामनाएँ|buena suerte|bonne chance|viel Glück
congratulations|बधाई हो|felicidades|félicitations|herzlichen Glückwunsch
let's go|चलो चलें|vamos|allons-y|los geht's
have a nice day|आपका दिन शुभ हो|que tengas un buen día|bonne journée|schönen Tag noch
take care|अपना ख्याल रखना|cuídate|prends soin de toi|pass auf dich auf
good job|शाबाश|buen trabajo|bon travail|gut gemacht
very good|बहुत अच्छा|muy bien|très bien|sehr gut
i am hungry|मुझे भूख लगी है|tengo hambre|j'ai faim|ich habe Hunger
i am thirsty|मुझे प्यास लगी है|tengo sed|j'ai soif|ich habe Durst
i am tired|मैं थका हुआ हूँ|estoy cansado|je suis fatigué|ich bin müde
straight ahead|सीधे|todo recto|tout droit|geradeaus
i am|मैं हूँ|soy|je suis|ich bin
i'm|मैं हूँ|soy|je suis|ich bin
you are|आप हैं|eres|vous êtes|du bist
it is|यह है|eso es|c'est|es ist
it's|यह है|eso es|c'est|es ist
there is|वहाँ है|hay|il y a|es gibt
i have|मेरे पास है|tengo|j'ai|ich habe
do you have|क्या आपके पास है|tienes|avez-vous|hast du
i want|मुझे चाहिए|quiero|je veux|ich will
i need|मुझे ज़रूरत है|necesito|j'ai besoin de|ich brauche
i like|मुझे पसंद है|me gusta|j'aime|ich mag
i can|मैं कर सकता हूँ|puedo|je peux|ich kann
welcome|स्वागत है|bienvenido|bienvenue|willkommen
yes|हाँ|sí|oui|ja
no|नहीं|no|non|nein
maybe|शायद|quizás|peut-être|vielleicht
okay|ठीक है|vale|d'accord|okay
ok|ठीक है|vale|d'accord|okay
really|सच में|de verdad|vraiment|wirklich
good|अच्छा|bueno|bon|gut
well|अच्छी तरह|bien|bien|gut
fine|ठीक|bien|bien|gut
I|मैं|yo|je|ich
you|आप|tú|vous|du
he|वह|él|il|er
she|वह|ella|elle|sie
it|यह|eso|ça|es
we|हम|nosotros|nous|wir
they|वे|ellos|ils|sie
me|मुझे|me|moi|mich
my|मेरा|mi|mon|mein
your|आपका|tu|ton|dein
his|उसका|su|son|sein
her|उसकी|su|sa|ihr
our|हमारा|nuestro|notre|unser
their|उनका|su|leur|ihr
this|यह|esto|ceci|dies
that|वह|eso|cela|das
these|ये|estos|ces|diese
those|वे|esos|ceux|jene
who|कौन|quién|qui|wer
what|क्या|qué|quoi|was
where|कहाँ|dónde|où|wo
when|कब|cuándo|quand|wann
why|क्यों|por qué|pourquoi|warum
how|कैसे|cómo|comment|wie
which|कौन सा|cuál|quel|welche
here|यहाँ|aquí|ici|hier
there|वहाँ|allí|là|dort
now|अब|ahora|maintenant|jetzt
today|आज|hoy|aujourd'hui|heute
tomorrow|कल|mañana|demain|morgen
yesterday|बीता हुआ कल|ayer|hier|gestern
always|हमेशा|siempre|toujours|immer
never|कभी नहीं|nunca|jamais|nie
sometimes|कभी-कभी|a veces|parfois|manchmal
often|अक्सर|a menudo|souvent|oft
again|फिर से|otra vez|encore|wieder
also|भी|también|aussi|auch
only|केवल|solo|seulement|nur
very|बहुत|muy|très|sehr
more|अधिक|más|plus|mehr
less|कम|menos|moins|weniger
much|बहुत|mucho|beaucoup|viel
many|कई|muchos|beaucoup de|viele
little|थोड़ा|poco|peu|wenig
all|सब|todo|tout|alle
some|कुछ|algunos|quelques|einige
nothing|कुछ नहीं|nada|rien|nichts
everything|सब कुछ|todo|tout|alles
something|कुछ|algo|quelque chose|etwas
someone|कोई|alguien|quelqu'un|jemand
everyone|सब लोग|todos|tout le monde|alle
and|और|y|et|und
or|या|o|ou|oder
but|लेकिन|pero|mais|aber
because|क्योंकि|porque|parce que|weil
if|अगर|si|si|wenn
with|के साथ|con|avec|mit
without|के बिना|sin|sans|ohne
for|के लिए|para|pour|für
of|का|de|de|von
from|से|desde|depuis|aus
to|को|a|à|zu
in|में|en|dans|in
on|पर|sobre|sur|auf
under|के नीचे|debajo|sous|unter
before|पहले|antes|avant|vor
after|बाद में|después|après|nach
the||el|le|der
~the||la|la|die
~the||los|les|das
~the||las|les|den
a|एक|un|un|ein
an|एक|un|un|ein
~a||una|une|eine
is|है|es|est|ist
are|हैं|son|sont|sind
am|हूँ|soy|suis|bin
was|था|era|était|war
be|होना|ser|être|sein
have|पास होना|tener|avoir|haben
has|पास है|tiene|a|hat
do|करना|hacer|faire|machen
not|नहीं|no|pas|nicht
can|सकना|poder|pouvoir|können
want|चाहना|querer|vouloir|wollen
need|ज़रूरत|necesitar|avoir besoin|brauchen
like|पसंद|gustar|aimer|mögen
love|प्यार|amor|amour|Liebe
go|जाना|ir|aller|gehen
come|आना|venir|venir|kommen
eat|खाना|comer|manger|essen
drink|पीना|beber|boire|trinken
sleep|सोना|dormir|dormir|schlafen
speak|बोलना|hablar|parler|sprechen
read|पढ़ना|leer|lire|lesen
write|लिखना|escribir|écrire|schreiben
see|देखना|ver|voir|sehen
hear|सुनना|oír|entendre|hören
know|जानना|saber|savoir|wissen
think|सोचना|pensar|penser|denken
work|काम|trabajo|travail|Arbeit
play|खेलना|jugar|jouer|spielen
buy|खरीदना|comprar|acheter|kaufen
give|देना|dar|donner|geben
take|लेना|tomar|prendre|nehmen
make|बनाना|hacer|faire|machen
help|मदद|ayuda|aide|Hilfe
open|खोलना|abrir|ouvrir|öffnen
close|बंद करना|cerrar|fermer|schließen
wait|रुको|esperar|attendre|warten
stop|रुको|parar|arrêter|stoppen
start|शुरू करना|empezar|commencer|anfangen
learn|सीखना|aprender|apprendre|lernen
understand|समझना|entender|comprendre|verstehen
live|रहना|vivir|vivre|leben
walk|चलना|caminar|marcher|gehen
run|दौड़ना|correr|courir|laufen
sit|बैठना|sentarse|s'asseoir|sitzen
call|बुलाना|llamar|appeler|anrufen
pay|भुगतान करना|pagar|payer|bezahlen
find|ढूँढना|encontrar|trouver|finden
cook|पकाना|cocinar|cuisiner|kochen
travel|यात्रा करना|viajar|voyager|reisen
look|देखो|mirar|regarder|schauen
listen|सुनो|escuchar|écouter|zuhören
man|आदमी|hombre|homme|Mann
woman|औरत|mujer|femme|Frau
child|बच्चा|niño|enfant|Kind
boy|लड़का|chico|garçon|Junge
girl|लड़की|chica|fille|Mädchen
friend|दोस्त|amigo|ami|Freund
family|परिवार|familia|famille|Familie
mother|माँ|madre|mère|Mutter
father|पिता|padre|père|Vater
brother|भाई|hermano|frère|Bruder
sister|बहन|hermana|sœur|Schwester
son|बेटा|hijo|fils|Sohn
daughter|बेटी|hija|fille|Tochter
husband|पति|esposo|mari|Ehemann
wife|पत्नी|esposa|épouse|Ehefrau
people|लोग|gente|gens|Leute
teacher|शिक्षक|profesor|professeur|Lehrer
student|छात्र|estudiante|étudiant|Student
name|नाम|nombre|nom|Name
house|घर|casa|maison|Haus
home|घर|hogar|maison|Zuhause
room|कमरा|habitación|chambre|Zimmer
door|दरवाज़ा|puerta|porte|Tür
window|खिड़की|ventana|fenêtre|Fenster
table|मेज़|mesa|table|Tisch
chair|कुर्सी|silla|chaise|Stuhl
bed|बिस्तर|cama|lit|Bett
kitchen|रसोई|cocina|cuisine|Küche
bathroom|बाथरूम|baño|salle de bain|Badezimmer
toilet|शौचालय|baño|toilettes|Toilette
city|शहर|ciudad|ville|Stadt
country|देश|país|pays|Land
street|सड़क|calle|rue|Straße
road|रास्ता|camino|route|Weg
school|स्कूल|escuela|école|Schule
hospital|अस्पताल|hospital|hôpital|Krankenhaus
doctor|डॉक्टर|médico|médecin|Arzt
medicine|दवा|medicina|médicament|Medikament
pain|दर्द|dolor|douleur|Schmerz
emergency|आपातकाल|emergencia|urgence|Notfall
police|पुलिस|policía|police|Polizei
fire|आग|fuego|feu|Feuer
danger|खतरा|peligro|danger|Gefahr
shop|दुकान|tienda|magasin|Geschäft
market|बाज़ार|mercado|marché|Markt
restaurant|रेस्टोरेंट|restaurante|restaurant|Restaurant
menu|मेन्यू|menú|menu|Speisekarte
bill|बिल|cuenta|addition|Rechnung
hotel|होटल|hotel|hôtel|Hotel
bank|बैंक|banco|banque|Bank
office|दफ़्तर|oficina|bureau|Büro
station|स्टेशन|estación|gare|Bahnhof
airport|हवाई अड्डा|aeropuerto|aéroport|Flughafen
train|ट्रेन|tren|train|Zug
bus|बस|autobús|bus|Bus
car|गाड़ी|coche|voiture|Auto
bicycle|साइकिल|bicicleta|vélo|Fahrrad
plane|हवाई जहाज़|avión|avion|Flugzeug
ticket|टिकट|billete|billet|Fahrkarte
key|चाबी|llave|clé|Schlüssel
bag|थैला|bolsa|sac|Tasche
shoes|जूते|zapatos|chaussures|Schuhe
clothes|कपड़े|ropa|vêtements|Kleidung
money|पैसा|dinero|argent|Geld
price|कीमत|precio|prix|Preis
time|समय|tiempo|temps|Zeit
day|दिन|día|jour|Tag
night|रात|noche|nuit|Nacht
morning|सुबह|mañana|matin|Morgen
evening|शाम|tarde|soir|Abend
week|हफ़्ता|semana|semaine|Woche
month|महीना|mes|mois|Monat
year|साल|año|année|Jahr
hour|घंटा|hora|heure|Stunde
minute|मिनट|minuto|minute|Minute
water|पानी|agua|eau|Wasser
food|खाना|comida|nourriture|Essen
bread|रोटी|pan|pain|Brot
rice|चावल|arroz|riz|Reis
milk|दूध|leche|lait|Milch
tea|चाय|té|thé|Tee
coffee|कॉफ़ी|café|café|Kaffee
juice|जूस|zumo|jus|Saft
fruit|फल|fruta|fruit|Obst
apple|सेब|manzana|pomme|Apfel
banana|केला|plátano|banane|Banane
vegetable|सब्ज़ी|verdura|légume|Gemüse
meat|मांस|carne|viande|Fleisch
chicken|चिकन|pollo|poulet|Hähnchen
fish|मछली|pescado|poisson|Fisch
egg|अंडा|huevo|œuf|Ei
sugar|चीनी|azúcar|sucre|Zucker
salt|नमक|sal|sel|Salz
breakfast|नाश्ता|desayuno|petit déjeuner|Frühstück
lunch|दोपहर का खाना|almuerzo|déjeuner|Mittagessen
dinner|रात का खाना|cena|dîner|Abendessen
book|किताब|libro|livre|Buch
phone|फ़ोन|teléfono|téléphone|Telefon
computer|कंप्यूटर|ordenador|ordinateur|Computer
music|संगीत|música|musique|Musik
language|भाषा|idioma|langue|Sprache
English|अंग्रेज़ी|inglés|anglais|Englisch
Hindi|हिन्दी|hindi|hindi|Hindi
Spanish|स्पेनिश|español|espagnol|Spanisch
French|फ़्रेंच|francés|français|Französisch
German|जर्मन|alemán|allemand|Deutsch
question|सवाल|pregunta|question|Frage
answer|जवाब|respuesta|réponse|Antwort
problem|समस्या|problema|problème|Problem
world|दुनिया|mundo|monde|Welt
life|ज़िंदगी|vida|vie|Leben
health|स्वास्थ्य|salud|santé|Gesundheit
weather|मौसम|clima|météo|Wetter
sun|सूरज|sol|soleil|Sonne
moon|चाँद|luna|lune|Mond
rain|बारिश|lluvia|pluie|Regen
sky|आसमान|cielo|ciel|Himmel
sea|समुद्र|mar|mer|Meer
beach|समुद्र तट|playa|plage|Strand
mountain|पहाड़|montaña|montagne|Berg
river|नदी|río|rivière|Fluss
tree|पेड़|árbol|arbre|Baum
flower|फूल|flor|fleur|Blume
dog|कुत्ता|perro|chien|Hund
cat|बिल्ली|gato|chat|Katze
bird|पक्षी|pájaro|oiseau|Vogel
head|सिर|cabeza|tête|Kopf
hand|हाथ|mano|main|Hand
eye|आँख|ojo|œil|Auge
heart|दिल|corazón|cœur|Herz
gift|तोहफ़ा|regalo|cadeau|Geschenk
job|नौकरी|empleo|emploi|Job
idea|विचार|idea|idée|Idee
way|तरीका|manera|façon|Art
thing|चीज़|cosa|chose|Ding
place|जगह|lugar|endroit|Ort
number|संख्या|número|numéro|Nummer
letter|पत्र|carta|lettre|Brief
email|ईमेल|correo|e-mail|E-Mail
picture|तस्वीर|foto|photo|Bild
game|खेल|juego|jeu|Spiel
party|पार्टी|fiesta|fête|Party
birthday|जन्मदिन|cumpleaños|anniversaire|Geburtstag
holiday|छुट्टी|vacaciones|vacances|Urlaub
left|बाएँ|izquierda|gauche|links
up|ऊपर|arriba|en haut|oben
down|नीचे|abajo|en bas|unten
inside|अंदर|dentro|dedans|drinnen
outside|बाहर|fuera|dehors|draußen
bad|बुरा|malo|mauvais|schlecht
big|बड़ा|grande|grand|groß
small|छोटा|pequeño|petit|klein
new|नया|nuevo|nouveau|neu
old|पुराना|viejo|vieux|alt
young|जवान|joven|jeune|jung
hot|गरम|caliente|chaud|heiß
cold|ठंडा|frío|froid|kalt
happy|खुश|feliz|heureux|glücklich
sad|उदास|triste|triste|traurig
beautiful|सुंदर|hermoso|beau|schön
easy|आसान|fácil|facile|einfach
difficult|मुश्किल|difícil|difficile|schwierig
fast|तेज़|rápido|rapide|schnell
slow|धीमा|lento|lent|langsam
right|सही|correcto|correct|richtig
wrong|गलत|incorrecto|faux|falsch
important|ज़रूरी|importante|important|wichtig
free|मुफ़्त|gratis|gratuit|kostenlos
cheap|सस्ता|barato|bon marché|billig
expensive|महँगा|caro|cher|teuer
long|लंबा|largo|long|lang
short|छोटा|corto|court|kurz
near|पास|cerca|près|nah
far|दूर|lejos|loin|weit
early|जल्दी|temprano|tôt|früh
late|देर से|tarde|tard|spät
clean|साफ़|limpio|propre|sauber
dirty|गंदा|sucio|sale|schmutzig
full|भरा हुआ|lleno|plein|voll
empty|खाली|vacío|vide|leer
ready|तैयार|listo|prêt|bereit
sick|बीमार|enfermo|malade|krank
tired|थका हुआ|cansado|fatigué|müde
hungry|भूखा|hambriento|affamé|hungrig
delicious|स्वादिष्ट|delicioso|délicieux|lecker
best|सबसे अच्छा|mejor|meilleur|beste
first|पहला|primero|premier|erste
last|आखिरी|último|dernier|letzte
next|अगला|siguiente|prochain|nächste
other|दूसरा|otro|autre|andere
same|वही|mismo|même|gleich
red|लाल|rojo|rouge|rot
blue|नीला|azul|bleu|blau
green|हरा|verde|vert|grün
yellow|पीला|amarillo|jaune|gelb
black|काला|negro|noir|schwarz
white|सफ़ेद|blanco|blanc|weiß
orange|नारंगी|naranja|orange|orange
pink|गुलाबी|rosa|rose|rosa
brown|भूरा|marrón|marron|braun
gray|स्लेटी|gris|gris|grau
zero|शून्य|cero|zéro|null
one|एक|uno|un|eins
two|दो|dos|deux|zwei
three|तीन|tres|trois|drei
four|चार|cuatro|quatre|vier
five|पाँच|cinco|cinq|fünf
six|छह|seis|six|sechs
seven|सात|siete|sept|sieben
eight|आठ|ocho|huit|acht
nine|नौ|nueve|neuf|neun
ten|दस|diez|dix|zehn
hundred|सौ|cien|cent|hundert
thousand|हज़ार|mil|mille|tausend
Monday|सोमवार|lunes|lundi|Montag
Tuesday|मंगलवार|martes|mardi|Dienstag
Wednesday|बुधवार|miércoles|mercredi|Mittwoch
Thursday|गुरुवार|jueves|jeudi|Donnerstag
Friday|शुक्रवार|viernes|vendredi|Freitag
Saturday|शनिवार|sábado|samedi|Samstag
Sunday|रविवार|domingo|dimanche|Sonntag
January|जनवरी|enero|janvier|Januar
February|फ़रवरी|febrero|février|Februar
March|मार्च|marzo|mars|März
April|अप्रैल|abril|avril|April
May|मई|mayo|mai|Mai
June|जून|junio|juin|Juni
July|जुलाई|julio|juillet|Juli
August|अगस्त|agosto|août|August
September|सितंबर|septiembre|septembre|September
October|अक्टूबर|octubre|octobre|Oktober
November|नवंबर|noviembre|novembre|November
December|दिसंबर|diciembre|décembre|Dezember
`
