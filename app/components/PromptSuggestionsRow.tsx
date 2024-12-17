import PromptSuggestionButton from "./PromptSuggestionButton";

const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "Who is the highest-paid chess player in the world?",
    "Who is the current Chess World Champion?",
    "What is the longest game ever played in a Chess World Championship?",
    "Who holds the record for the most Chess World Championship titles?",
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
