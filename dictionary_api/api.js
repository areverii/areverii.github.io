function get_word_info() {
    const word_input = $('#word_input').val();
    if (!word_input) {
        alert('please enter a word!');
        return;
    }

    $.ajax({
        url: `https://api.dictionaryapi.dev/api/v2/entries/en/${word_input}`,
        method: 'GET',
        success: function(data) {
            display_word_info(data);
        },
        error: function() {
            console.error('error getting word info');
            alert('oh no! there was an error getting the word info! please try another.');
        }
    });
}

function display_word_info(data) {
    const result_div = $('#result');
    result_div.empty();

    if (!data || data.title) {
        result_div.html("<p>the word was not found in this dictionary!</p>");
        return;
    }

    const word = data[0].word;
    const phonetic = data[0].phonetic || "no phonetic data found";
    const meanings = data[0].meanings.map(meaning => ({
        part_of_speech: meaning.partOfSpeech,
        definitions: meaning.definitions.map(def => def.definition).join('; ')
    }));

    const word_info_div = $('<div></div>').addClass('word-info');

    const word_heading = $('<h3></h3>').text(`word: ${word}`);
    word_info_div.append(word_heading);

    const phonetic_para = $('<p></p>').text(`phonetic: ${phonetic}`);
    word_info_div.append(phonetic_para);

    meanings.forEach((meaning, index) => {
        const meaning_div = $('<div></div>').addClass('meaning');

        const part_of_speech_heading = $('<h4></h4>').text(`meaning ${index + 1} (part of speech: ${meaning.part_of_speech}):`);
        meaning_div.append(part_of_speech_heading);

        const definitions_para = $('<p></p>').text(`definitions: ${meaning.definitions}`);
        meaning_div.append(definitions_para);

        word_info_div.append(meaning_div);
    });

    result_div.append(word_info_div);
}
