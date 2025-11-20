chrome.commands.onCommand.addListener((command) => {
  if (command === "open-bogsti-popup") {
    chrome.action.openPopup();
  }
});