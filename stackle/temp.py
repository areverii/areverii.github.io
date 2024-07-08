import json

def convert_wordlist_to_json(input_file, output_file):
    # Read the wordlist from the text file
    with open(input_file, 'r') as file:
        words = file.read().splitlines()
    
    # Convert the list of words to a JSON object
    words_json = json.dumps(words, indent=4)
    
    # Write the JSON object to the output file
    with open(output_file, 'w') as file:
        file.write(words_json)

# Example usage
input_file = 'words.txt'
output_file = 'words.json'
convert_wordlist_to_json(input_file, output_file)