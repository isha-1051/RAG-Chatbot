import PromptSuggestionButton from "./PromptSuggestionButton";

const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "What is the price of Gaming Keyboard?",
    "What is rating of Wireless Mouse?",
  ];

  return (
    <div className="prompt-suggestion-row">
      {prompts?.map((prompt, index) =>
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          text={prompt}
          onClick={() => onPromptClick(prompt)}
        />)}
    </div>
  );
};

export default PromptSuggestionsRow;
