# Automate TPI testing

Skill that runs a test plan item

- comes up with a test plan with test variations
   - user gets to review and approve
- runs a subagent or subsession for each test variation
- each test run runs a separated, isolated VS Code instance observed by playwrite and debugger
- track progress, logs, workspace, user-data, chat session log, timing
- reports test result, screenshots, issues found
- reports how to improme the test scripts and the skill


# Challenges
- [x] start VS Code signed in 
- [x] disable all modal dialogs (playwrite doesn't see them)
- [~] speed up the test execution. It currently take around 40 min to run my TPI
   - After each run ask it to apply its learnigs to improve the scripts
   - Allow parallel execution by tell it to no request focus
