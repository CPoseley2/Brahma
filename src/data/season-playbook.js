export const tokenDomains = [
  { id: "teamwork", name: "Teamwork", colors: "Green / Black", className: "teamwork", promise: "I helped someone, shared space, or made the team better.", coachLooksFor: "Inviting a teammate, returning a ball, sharing equipment, celebrating someone else, or solving a problem together." },
  { id: "love", name: "Love of the Game", colors: "Red", className: "love", promise: "I brought joy, energy, and curiosity to play.", coachLooksFor: "Eager participation, imagination, laughter, returning after a break, or helping the group love the game." },
  { id: "brave", name: "Brave Shots", colors: "Yellow", className: "brave", promise: "I tried something bold, even when it might not work.", coachLooksFor: "Taking a shot, trying the other foot, facing a defender, recovering from a miss, or trying again." },
  { id: "tactics", name: "Tactics", colors: "Blue", className: "tactics", promise: "I noticed space, a goal, a teammate, or what the game was asking.", coachLooksFor: "Looking up, finding open grass, choosing a goal, changing direction, spreading out, or recognizing a restart." },
];

const drill = (id, title, category, story, setup, play, cues, variations, tokenIds, equipment = "One ball per player, cones, and two pop-up goals") => ({
  id, title, category, story, setup, play, cues, variations, tokenIds, equipment,
});

export const drillLibrary = [
  drill("arrival-adventure", "Arrival Ball Adventure", "Arrival play", "Every player enters their own tiny soccer world.", "Make a welcoming 20×20-yard area with four colorful corner homes. Every arriving player gets a ball.", "Let children explore. Offer optional missions: visit every home, stop on an island, draw a giant circle, or show the coach a new move.", ["One ball each", "No lines", "Greet the child before correcting the ball"], ["Add music", "Invite a player to invent the next mission"], ["love", "brave"]),
  drill("traffic-lights", "Traffic Lights", "Ball mastery", "Players drive soccer cars through a busy town.", "Scatter players with balls in a large grid. Coach stands where everyone can see.", "Green means dribble, yellow means tiny touches, red means stop the ball, blue means turn, and rainbow means celebrate any move.", ["Soft touches in traffic", "Find empty road", "Stop with control"], ["Let children call colors", "Add reverse gear with a pullback"], ["tactics", "love"]),
  drill("animal-moves", "Animal Moves", "Movement", "The field becomes a zoo and the balls become animal friends.", "Open grid, one ball per player. Place four cones as zoo habitats.", "Travel like a cheetah, crab, frog, penguin, or elephant—with and without the ball. Players choose how each animal controls the ball.", ["Explore many ways to move", "Balance before speed", "There is no single correct animal"], ["Players invent an animal", "Move to a new habitat on command"], ["love", "brave"]),
  drill("body-part-freeze", "Body-Part Freeze", "Ball mastery", "A magic spell freezes the ball beneath a body part.", "Players dribble freely with personal space.", "Call red light and a body part: sole, knee, elbow, tummy, or forehead. Players safely freeze their ball, then restart.", ["Slow down before the freeze", "Keep heads up for friends", "Laugh and reset"], ["Player becomes caller", "Freeze beside a teammate"], ["love", "teamwork"]),
  drill("gates-galore", "Gates Galore", "Dribbling", "Players collect stamps by traveling through magic gates.", "Build 12–16 two-cone gates throughout a 25×20-yard area. One ball per child.", "Dribble through as many different gates as possible. A gate counts only when the player and ball travel through together.", ["Look for a free gate", "Touch into space", "Turn away from traffic"], ["Use only a chosen foot", "Partners collect gates together", "Add a 45-second personal challenge"], ["tactics", "brave"]),
  drill("treasure-island", "Treasure Island", "Dribbling", "Players sail from island to island without losing their treasure.", "Scatter flat cones as islands and give every player a ball.", "Dribble in the ocean. On ‘storm,’ find an island and stop the treasure. Remove no islands and eliminate nobody—friends share crowded islands.", ["See the island before traveling", "Small touches near land", "Make room for shipmates"], ["Two players share one island", "Call an island color", "Add sea-monster coaches"], ["teamwork", "tactics"]),
  drill("mud-monsters", "Mud Monsters", "Evasion", "Friendly mud monsters tag players, who can be rescued by teammates.", "Mark a large grid. Begin without balls, then add one per runner.", "Tagged players freeze in a wide star. A teammate rescues them with a high-five or by dribbling through a nearby rescue gate.", ["Change direction", "Find open grass", "Rescue before racing away"], ["Players rotate as monsters", "Two-person rescue", "Ball version"], ["teamwork", "tactics"]),
  drill("sharks-minnows", "Sharks & Minnows—Everyone Returns", "Evasion", "Minnows cross the ocean while sharks try to tap balls away.", "Create two safe shores 20 yards apart. One or two sharks begin in the middle.", "Minnows dribble across. If a shark taps a ball out, the minnow retrieves it, performs three toe taps, and immediately rejoins.", ["Change speed", "Protect the ball with your body", "Look for open water"], ["Cross in pairs", "Add side shores", "Sharks become helpers after each round"], ["brave", "tactics"]),
  drill("sleeping-giants", "Sleeping Giants", "Ball control", "Players sneak treasure past sleeping giants.", "Coaches or cones are giants in a grid. One ball per player and goals at the far end.", "Players dribble quietly while giants sleep. When a giant wakes, freeze the ball. Reach the castle and finish into a goal.", ["Tiny quiet touches", "Stop when danger appears", "Then explode toward goal"], ["Giants slowly walk", "Players choose the wake-up word"], ["love", "tactics"]),
  drill("volcano-craters", "Volcanoes & Craters", "Ball mastery", "Cones are flipped into volcanoes and craters by two busy teams.", "Scatter equal numbers of disc cones upright and upside down. Divide players into two playful crews; balls optional.", "For 45 seconds one crew makes volcanoes and the other makes craters. Reset, swap jobs, then celebrate the whole field rather than declaring winners.", ["Find empty space", "Bend and balance safely", "Keep playing to the whistle"], ["Dribble to each cone", "Partners flip together"], ["teamwork", "love"], "Disc cones; add one ball per player for progression"),
  drill("clean-room", "Clean Your Room", "Striking", "Two teams send soccer toys back to the other bedroom.", "Divide a 25×20 area in half. Place many balls on both sides with a safe center buffer.", "Players use their feet to pass or strike balls into the other half. Stop every 45–60 seconds to reset and notice safe striking choices.", ["Find a ball, look, then strike", "Keep balls on the ground", "Help gather every ball"], ["Use the other foot", "Aim through gates", "Cooperative goal: clear both rooms together"], ["teamwork", "brave"], "Many balls, cones, and optional target gates"),
  drill("castle-crashers", "Castle Crashers", "Shooting", "Players knock down cone castles to free friendly dragons.", "Build several cone castles 8–12 yards from shooting spots. One ball per player.", "Dribble toward any open castle and shoot. Rebuild every castle together after the round.", ["Approach under control", "Plant beside the ball", "Try again after every miss"], ["Move castles farther away", "Add a gate before the shot", "Shoot a rolling ball"], ["brave", "teamwork"]),
  drill("goal-hunters", "Goal Hunters", "Shooting", "Every goal is a portal to a new world.", "Place four or more small goals around the outside of a large grid. Players have balls in the middle.", "Score in a goal, celebrate, turn back into the field, and hunt for a different open goal.", ["See the goal", "Last touch sets up the shot", "Move after scoring"], ["Different foot at each goal", "Coach guards one portal", "Partner goal hunt"], ["brave", "tactics"]),
  drill("cannonball", "Cannonball Run", "Shooting", "Pirates fire cannonballs through gates before the tide changes.", "Create multiple cone gates with space behind them. One ball per player.", "Players dribble to a gate and strike through it. They chase their own cannonball and choose another gate.", ["Look before firing", "Strike through the middle", "Accuracy before power"], ["Narrow or widen gates", "Rolling service from a coach", "Count team cannonballs"], ["brave", "tactics"]),
  drill("knock-cones", "Knock the Cones", "Shooting", "The team works together to topple a forest.", "Place 10–20 tall cones across a safe shooting zone. Players line the perimeter with balls—no standing behind targets.", "Everyone shoots to knock down cones. Players retrieve only on the reset signal, then rebuild the forest together.", ["Check the path is clear", "Plant foot points toward target", "Cheer every attempt"], ["Different distances", "Partner roll-and-shoot", "Beat the team’s previous time"], ["teamwork", "brave"], "Balls and tall cones"),
  drill("follow-leader", "Follow the Leader", "Awareness", "A tiny parade travels through soccer country.", "Pairs each have balls and enough space. One is leader, one explorer.", "Leader dribbles a safe path with stops, turns, and celebrations. Explorer follows without racing. Swap often.", ["Look up at the leader", "Leave friendly space", "Copy, then create"], ["One ball between partners", "Groups of three", "Leader travels through gates"], ["teamwork", "love"]),
  drill("mirror-moves", "Mirror Moves", "Ball mastery", "Partners become magic mirrors.", "Pairs face one another across a cone line, each with a ball.", "One child makes gentle side-to-side touches, stops, or turns; the mirror copies. Switch after 30–45 seconds.", ["Watch your partner", "Move at copyable speed", "Celebrate creative moves"], ["No-ball movement first", "Mirror toward a goal and finish"], ["teamwork", "brave"]),
  drill("robin-hood", "Robin Hood", "Team challenge", "Teams bring treasure home one piece at a time.", "Put balls or beanbags in a center treasure circle. Create several team homes around it.", "One player at a time from each home travels to collect one treasure, then tags a teammate. With balls, dribble treasure home.", ["One treasure at a time", "Tag gently", "Help organize the home"], ["All players move continuously", "Borrow from other homes only with coach signal"], ["teamwork", "love"], "Balls or beanbags, cones, pinnies"),
  drill("team-gates", "Team Gate Quest", "Cooperation", "Partners unlock gates only by arriving together.", "Scatter gates. Pairs share one ball or use one each.", "Partners travel through gates together. With one ball, use a gentle pass through the gate and meet on the other side.", ["Stay connected", "Pass where a friend can reach", "Choose an open gate together"], ["Use two balls in sync", "Groups of three", "Finish at a goal"], ["teamwork", "tactics"]),
  drill("one-v-one-gates", "1v1 to Two Gates", "Opposed play", "An attacker chooses one of two escape doors.", "Make several 10×8-yard fields, each with two cone gates on the defender’s end. One ball per pair.", "Attacker scores by dribbling through either gate. Defender can win and attack the opposite line. Play 20–30 seconds, then reset and switch.", ["Attack open space", "Change direction when one door closes", "Defend the space, not the child"], ["Wider gates", "Add a shooting goal", "Start side-by-side"], ["brave", "tactics"]),
  drill("one-v-one-goal", "1v1 to Goal", "Opposed play", "A brave attacker tries to reach the castle before the guard.", "Use several short fields with one small goal and a safe supply of balls beside the coach.", "Coach rolls a ball into play. Two players enter, compete, and finish. End quickly, celebrate effort, and send the next pair.", ["Go toward goal", "Try a move or change speed", "Recover and keep playing"], ["Start attacker closer", "Use two goals", "2v1 for confidence"], ["brave", "tactics"]),
  drill("numbers-game", "Numbers Game", "Transition", "Players hear their secret number and race into a tiny game.", "Create one 15×12 field with two goals. Two teams stand safely beside their goal and receive matching numbers.", "Coach calls one or more numbers and rolls in a ball. Called players play until a goal or ball out, then exit for the next group.", ["Find the ball first", "Know which goal to attack", "Switch from attack to defend"], ["Call two numbers", "Add a second ball briefly", "Use colors instead of numbers"], ["tactics", "brave"]),
  drill("end-zone", "End-Zone Soccer", "Space", "Teams deliver the ball to a friendly landing zone.", "Play 2v2 or 3v3 on a wide field with an end zone at each end instead of goals.", "Score by dribbling under control into the attacking end zone. Restart quickly from the other team’s end.", ["Make the field big", "Carry into open grass", "Turn when the path closes"], ["Pass to a teammate in the zone", "Add two corner zones"], ["teamwork", "tactics"]),
  drill("four-goal-game", "Four-Goal Game", "Decision making", "Two teams can open more than one treasure door.", "Play 2v2 or 3v3 with two small goals on each end line.", "Teams attack either of their two goals. Coach feeds new balls quickly and avoids long stoppages.", ["Look for the open goal", "Spread away from the ball", "Change the plan when crowded"], ["Diagonal goals", "Must attack a different goal after scoring"], ["tactics", "brave"]),
  drill("wide-river", "Cross the Wide River", "Space", "The team stretches the river so everyone has room to sail.", "Use a wide 3v3 field with cone channels near both touchlines.", "Play normally. A team earns a cheer whenever a player uses an empty wide channel before attacking goal—no points needed.", ["Find grass away from the crowd", "Look before dribbling", "Friends can make room without the ball"], ["Remove channels after recognition", "Use four goals"], ["tactics", "teamwork"]),
  drill("pirate-ships", "Pirate Ships", "Transitions", "Crews sail, dock, and change ships when the weather turns.", "Mark four corner ships and a central sea. One ball per player.", "Players dribble in the sea. Coach calls a ship color, storm, trade ships, or rescue a friend. Finish each voyage with a shot.", ["Look before changing direction", "Control speed near a ship", "Make space for the crew"], ["Two balls become shared treasure", "A coach becomes a gentle sea monster"], ["love", "tactics"]),
  drill("capture-castle", "Capture the Castle", "Team challenge", "Small crews protect one castle and explore another.", "Create two end zones with cone treasures. Play 2v2 or 3v3, beginning without balls if needed.", "Carry or dribble one treasure from the opposite castle back home. Tagged players simply return to their own half and immediately rejoin.", ["Go together", "Notice when home needs help", "Choose attack or protect"], ["Add a soccer ball as the only treasure", "Multiple small castles"], ["teamwork", "tactics"]),
  drill("three-v-three", "Free 3v3 Soccer", "Small-sided game", "The game is the teacher.", "Build multiple 25×18-yard fields with two small goals, no goalkeepers, and spare balls around each field.", "Play 3v3 when possible; 2v2 and 4v4 are fine. Coach restarts quickly, keeps comments brief, and lets children solve the game.", ["Which way are we going?", "Can you find grass?", "What brave idea will you try?"], ["Four goals", "End zones", "Uneven numbers for a short challenge"], ["love", "brave", "teamwork", "tactics"]),
  drill("scrimmage-festival", "Scrimmage Festival", "Celebration", "Every tiny field is a new soccer adventure.", "Set up two or three small fields. Rotate teams every 4–5 minutes without standings.", "Play several short games with fast restarts. Between rounds offer water, a team cheer, and one new invitation—not a lecture.", ["Play more than we talk", "Mix teammates", "Notice joy and courage"], ["Family partners", "Four-goal round", "Coaches join only to connect play"], ["love", "teamwork", "brave", "tactics"]),
  drill("family-finale", "Family Adventure Circuit", "Celebration", "Players guide their families through favorite season adventures.", "Create four stations: gates, castle shots, partner mirrors, and 3v3. Players are the expert guides.", "Families rotate every 7–8 minutes. Finish with children choosing a favorite game and a whole-team celebration.", ["Let players explain", "Adults follow the child’s pace", "Celebrate growth stories"], ["Token storytelling station", "Player-created final challenge"], ["love", "teamwork", "brave", "tactics"]),
];

const block = (minutes, label, drillId, purpose) => ({ minutes, label, drillId, purpose });
const observationBlock = (minutes, label, drillId, purpose, guidance) => ({ minutes, label, drillId, purpose, guidance });
const session = (week, day, title, story, tokenFocus, discovery, challenge, finishing, game, homePlay) => ({
  id: `week-${week}-${day.toLowerCase()}`, week, day, title, story, tokenFocus, homePlay,
  blocks: [
    block(8, "Welcome play", "arrival-adventure", "Every child enters with a ball and an immediate invitation to play."),
    block(3, "Story huddle", null, story),
    block(10, "Adventure one", discovery, "Explore the day’s idea without pressure or elimination."),
    block(2, "Water & reset", null, "Water, one breath, one coaching sentence."),
    block(10, "Adventure two", challenge, "Add a decision, teammate, or gentle opponent."),
    block(10, "Brave finish", finishing, "Create many chances to aim, strike, miss, recover, and try again."),
    block(14, "The game", game, "Small-sided soccer with quick restarts and very little coach talk."),
    block(3, "Token circle", null, "Name specific choices that expressed today’s token domain; invite player reflections."),
  ],
});

export const firstSessionObservation = {
  id: "week-1-a",
  week: 1,
  day: "A",
  title: "First Session Observation",
  story: "A playful first look at how each child moves, explores the ball, understands the game, and responds to brief coaching prompts.",
  tokenFocus: "love",
  homePlay: "Show someone at home your favorite move from today.",
  sessionType: "baseline-observation",
  equipment: "One ball per player, two small goals, four colors of cones, pinnies, spare balls, water, and a four-player observation sheet.",
  blocks: [
    observationBlock(3, "Arrival Ball Adventure", "arrival-adventure", "See what appears naturally before coaching changes the behavior.", {
      setup: "Use one 18×15-yard field with two small goals, four colored cone homes, and one ball per child. Keep spare balls beside the coach.",
      run: "Greet each child, hand them a ball, and let all four explore at once. Intervene only for safety. Do not demonstrate or correct technique.",
      say: ["You can explore the whole field. Show me what your ball can do."],
      watch: ["How the child joins or seeks support", "Natural running, stopping, and turning", "How the child moves with, stops, or retrieves the ball", "Curiosity, awareness of others, and willingness to try again"],
      record: "Mark only spontaneous behaviors. A missing behavior is Not observed—not evidence that the child cannot do it.",
    }),
    observationBlock(3, "Animal Moves", "animal-moves", "Observe body control and the child’s response to four simple directions.", {
      setup: "Keep the same field. Children begin without a ball; add their balls for the final minute if the group is ready.",
      run: "Give each instruction once and allow time to respond. Keep the game moving; this is an invitation, not a test.",
      say: ["Move like a cheetah.", "Freeze.", "Turn and find a new home.", "Jump like a frog and land quietly."],
      watch: ["Starts and stops safely", "Changes direction", "Balances, jumps, and lands with control", "Responds to a short group instruction"],
      record: "For each child, note the least support needed: first group cue, personal repeat or gesture, demonstration, or no clear response.",
    }),
    observationBlock(6, "Soccer Cars", "traffic-lights", "Observe dribbling, stopping, turning, space awareness, and response to standardized ball prompts.", {
      setup: "Every child has a ball inside the same field. The four colored cone homes stay available as parking spaces.",
      run: "Let players drive freely. Deliver the four prompts about 45–60 seconds apart. Give the group cue once and wait five seconds. If needed, use the child’s name plus the same cue and a gesture; then demonstrate once.",
      say: ["Red light—stop your ball.", "Green light—find open road.", "Blue light—turn and go somewhere new.", "Park in a colored home."],
      watch: ["Keeps the ball nearby while moving", "Stops a rolling ball with a foot", "Turns or changes direction with the ball", "Notices open space and boundaries"],
      record: "Use S for spontaneous, 1 for first cue, 2 for personal repeat or gesture, 3 for demonstration, and NR when no clear response was observed.",
    }),
    observationBlock(5, "Goal Hunters", "goal-hunters", "Observe purposeful striking, target recognition, and recovery after a miss.", {
      setup: "Use the two goals already on the field. Each child keeps a ball and may attack either open goal.",
      run: "Players dribble to a goal, shoot, retrieve their own ball, and hunt for the other goal. Begin without technique cues. Add the second prompt after about two minutes.",
      say: ["Find a goal and score any way you can.", "Look at your goal before you shoot."],
      watch: ["Approaches a stationary or moving ball with balance", "Strikes forward with purpose", "Looks toward and shoots at the intended goal", "Retrieves the ball and tries again after a miss"],
      record: "Record attempts and behaviors, not goals scored. Goal totals mix skill with traffic, distance, and luck.",
    }),
    observationBlock(1, "Water & Quick Marks", null, "Give players a reset while the coach preserves the first half’s observations.", {
      setup: "Send players to water beside the field. Place two pinnie colors where the children can see their 2v2 teams.",
      run: "Make only quick codes or checkmarks—do not write long notes. Confirm the two goals and put spare balls beside you for fast restarts.",
      say: ["Grab water, then find your team color."],
      watch: ["Any child who needs transition support", "Safe sharing of space and equipment"],
      record: "Fill gaps only from something you actually saw. Leave every untested item as Not observed.",
    }),
    observationBlock(4, "2v2 — Quiet Coach", "three-v-three", "Capture natural game understanding before prompts influence play.", {
      setup: "Play 2v2 on the existing field with one goal at each end and no goalkeepers. Point out each team’s attacking goal once.",
      run: "Play continuously with fast coach restarts. Apart from safety and identifying the goals at the start, stay quiet and let the game teach.",
      say: ["This team scores here. This team scores there. Play soccer!"],
      watch: ["Moves toward the ball and joins play", "Attacks the intended goal", "Recognizes the boundary or a restart", "Changes job when the other team wins the ball", "Recovers and returns after a mistake"],
      record: "Reserve Seen in play for behaviors that appear spontaneously here. Note the context rather than assigning an overall player score.",
    }),
    observationBlock(5, "2v2 — Prompted Coach", "three-v-three", "See whether brief coaching language changes behavior and later transfers into play.", {
      setup: "Keep the same teams, field, goals, and restart method so the coaching prompts are the main change.",
      run: "Use only the four short prompts below, one at a time and only when relevant. Do not add an explanation. After a response, wait to see whether the behavior returns without another cue.",
      say: ["Which goal?", "Find grass.", "Can you get back in the game?", "What brave idea will you try?"],
      watch: ["Immediate response to a relevant prompt", "Change in direction, spacing, or rejoining", "A prompted behavior that later appears spontaneously", "Confidence, frustration recovery, and kind play"],
      record: "Mark the support level and add T when the behavior later transfers without another cue. Keep prompt responsiveness separate from technical skill.",
    }),
    observationBlock(3, "Show Me & Close", null, "Check recall through demonstration and finish with a specific success for every child.", {
      setup: "Bring the four children into a loose circle with a ball at each child’s feet.",
      run: "Ask children to show rather than verbally explain. Accept different solutions. Finish by naming one concrete, positive behavior you saw from each child.",
      say: ["Show me how you stop your ball.", "Show me which goal your team was attacking.", "Show me your favorite move from today."],
      watch: ["Recall through action", "Confidence demonstrating in front of the group", "Enjoyment, curiosity, and response to teammates"],
      record: "After practice, add one evidence sentence per child: what appeared naturally, what support helped, and whether anything transferred into the game.",
    }),
  ],
};

export const seasonPlan = [
  firstSessionObservation,
  session(1, "B", "Soccer Cars", "Discover starts, stops, and friendly traffic.", "tactics", "traffic-lights", "gates-galore", "castle-crashers", "three-v-three", "Make three safe stops with a ball."),
  session(2, "A", "Tiny Touch Explorers", "Keep treasure close while traveling through a busy world.", "love", "treasure-island", "gates-galore", "cannonball", "three-v-three", "Dribble around three household landmarks."),
  session(2, "B", "Turn Away From Trouble", "Notice a crowded road and choose a new one.", "tactics", "traffic-lights", "sharks-minnows", "goal-hunters", "four-goal-game", "Show a stop-and-turn to a family member."),
  session(3, "A", "Brave Feet", "Try both feet and treat mistakes as discoveries.", "brave", "body-part-freeze", "mirror-moves", "knock-cones", "three-v-three", "Take five gentle kicks with each foot."),
  session(3, "B", "Find the Open Gate", "Look up, find grass, and travel through it.", "tactics", "gates-galore", "mud-monsters", "cannonball", "four-goal-game", "Name an open space before dribbling into it."),
  session(4, "A", "Castle Crashers", "Approach, plant, and strike with joyful courage.", "brave", "sleeping-giants", "castle-crashers", "knock-cones", "one-v-one-goal", "Build a safe target and take ten brave shots."),
  session(4, "B", "Shoot, Miss, Smile, Repeat", "A miss is simply another invitation.", "brave", "goal-hunters", "cannonball", "castle-crashers", "numbers-game", "Celebrate one miss and immediately try again."),
  session(5, "A", "Friendly Mirrors", "Watch, copy, lead, and make room for a partner.", "teamwork", "follow-leader", "mirror-moves", "team-gates", "three-v-three", "Teach a family member one move."),
  session(5, "B", "Treasure Helpers", "Teams succeed by sharing jobs and returning together.", "teamwork", "robin-hood", "team-gates", "clean-room", "end-zone", "Help gather equipment or toys without being asked."),
  session(6, "A", "Two Escape Doors", "Face a defender and notice which path is open.", "tactics", "sharks-minnows", "one-v-one-gates", "goal-hunters", "four-goal-game", "Use one change of direction against a playful grown-up defender."),
  session(6, "B", "Brave Against a Guard", "Protect, change speed, and keep going after the ball changes owners.", "brave", "mud-monsters", "one-v-one-goal", "castle-crashers", "numbers-game", "Play a 30-second one-versus-one game."),
  session(7, "A", "Which Goal Is Ours?", "Recognize direction, restart quickly, and attack with purpose.", "tactics", "pirate-ships", "numbers-game", "goal-hunters", "three-v-three", "Point to the goal before beginning a family mini-game."),
  session(7, "B", "Attack and Recover", "When the ball changes teams, our next job changes too.", "teamwork", "capture-castle", "numbers-game", "cannonball", "three-v-three", "Practice saying ‘I can help!’ after losing the ball."),
  session(8, "A", "Make the Field Big", "Move away from the crowd and discover wide grass.", "tactics", "treasure-island", "wide-river", "goal-hunters", "four-goal-game", "Find the biggest open space in a room or yard."),
  session(8, "B", "Together, Not Tangled", "Teammates connect while still giving one another room.", "teamwork", "follow-leader", "team-gates", "clean-room", "wide-river", "Walk side-by-side while keeping a friendly arm’s space."),
  session(9, "A", "Choose a Door", "Look before acting and change the plan when the first door closes.", "tactics", "traffic-lights", "one-v-one-gates", "cannonball", "four-goal-game", "Call out an open gate before you enter it."),
  session(9, "B", "Try the Bold Idea", "Creativity is brave even when the ball gets away.", "brave", "animal-moves", "mirror-moves", "knock-cones", "one-v-one-goal", "Invent, name, and teach one new ball move."),
  session(10, "A", "Crew Decisions", "Small teams decide when to explore and when to protect.", "teamwork", "robin-hood", "capture-castle", "goal-hunters", "end-zone", "Take turns choosing a family game."),
  session(10, "B", "Fast New Adventures", "Restart, rejoin, and love the next play.", "love", "pirate-ships", "mud-monsters", "cannonball", "numbers-game", "After the ball leaves, retrieve it and restart quickly."),
  session(11, "A", "Pass Through Friendship", "A pass is a gift placed where a friend can play.", "teamwork", "team-gates", "follow-leader", "clean-room", "end-zone", "Roll or pass a ball gently to a partner ten times."),
  session(11, "B", "See Friend, See Space", "Look up long enough to notice both a teammate and open grass.", "tactics", "mirror-moves", "team-gates", "goal-hunters", "wide-river", "Before three touches, look up and name what you see."),
  session(12, "A", "Player-Created Practice", "Children choose missions and discover that their ideas belong.", "love", "animal-moves", "gates-galore", "castle-crashers", "scrimmage-festival", "Ask: what game should our team play next?"),
  session(12, "B", "Brave Game Day", "Bring our choices into many short, joyful games.", "brave", "sharks-minnows", "one-v-one-goal", "goal-hunters", "scrimmage-festival", "Name one brave thing you tried this season."),
  session(13, "A", "Four-Token Quest", "Revisit teamwork, joy, courage, and awareness in one adventure.", "teamwork", "robin-hood", "capture-castle", "knock-cones", "scrimmage-festival", "Tell someone the meaning of all four tokens."),
  session(13, "B", "Our Soccer Celebration", "Players lead, families join, and every child’s growth story is honored.", "love", "family-finale", "family-finale", "goal-hunters", "scrimmage-festival", "Keep playing together—the season ending does not end the game."),
];

export const drillById = id => drillLibrary.find(item => item.id === id);
export const tokenById = id => tokenDomains.find(item => item.id === id);
export const sessionMinutes = item => item.blocks.reduce((total, value) => total + value.minutes, 0);
