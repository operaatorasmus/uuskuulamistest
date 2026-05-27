#!/usr/bin/env ruby

require "json"
require "pathname"
require "uri"

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

ROOT = Pathname.new(Dir.pwd)
OUTPUT_FILE = ROOT.join("assets", "data", "tracks.js")
AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"].freeze
IGNORED_DIRECTORIES = [
  ".git",
  "assets",
  "scripts",
  "node_modules",
  "dist",
  "build",
].freeze

KNOWN_COMPOSERS = [
  "Giovanni Pierluigi da Palestrina",
  "Renessanssiaegne instrumentaalmuusika Itaaliast",
  "Keskaegne tantsumuusika Prantsusmaalt",
  "Wolfgang Amadeus Mozart",
  "Johann Sebastian Bach",
  "Georg Friedrich Händel",
  "Walther von der Vogelweide",
  "Christoph Willibald Gluck",
  "Jean-Baptiste Lully",
  "Ludwig van Beethoven",
  "Giovanni Gabrieli",
  "Franz Joseph Haydn",
  "Claudio Monteverdi",
  "Antonio Vivaldi",
  "Arcangelo Corelli",
  "Clement Janequin",
  "Guillaume de Machaut",
  "Guillaume Dufay",
  "Josquin Desprez",
  "Orlando di Lasso",
  "Philippe de Vitry",
  "Henry Purcell",
  "Martin Luther",
  "Gregooriuse koraal",
  "13. sajandi motett",
  "Leoninus",
].sort_by { |name| -name.length }.freeze

def utf8(value)
  value.to_s.dup.force_encoding(Encoding::UTF_8)
end

def class_number(name)
  match = utf8(name).match(/(\d{1,2})\s*\.?\s*klass/i)
  match ? match[1].to_i : Float::INFINITY
end

def class_label(name)
  number = class_number(name)
  number.finite? ? "#{number}. klass" : utf8(name).strip
end

def class_id(name)
  number = class_number(name)
  return "klass-#{number}" if number.finite?

  utf8(name).downcase.strip.gsub(/[^\p{L}\p{N}]+/, "-").gsub(/^-|-$/, "")
end

def compact_text(value)
  utf8(value).gsub("_", "").gsub(/\s+/, " ").strip
end

def parse_track_title(file_name)
  base_name = File.basename(utf8(file_name), ".*")
  without_number = base_name.sub(/^\s*\d+\s*-\s*/, "").strip

  known_composer = KNOWN_COMPOSERS.find { |composer| without_number.start_with?(composer) }
  if known_composer
    composer = compact_text(known_composer)
    work = compact_text((without_number[known_composer.length..] || "").sub(/^\s*-\s*/, ""))
    return {
      composer: composer,
      work: work,
      answer: work.empty? ? composer : "#{composer} - #{work}",
    }
  end

  if without_number.include?(" - ")
    composer, work = without_number.split(" - ", 2).map { |part| compact_text(part) }
    return {
      composer: composer,
      work: work,
      answer: "#{composer} - #{work}",
    }
  end

  underscore_index = without_number.index("_")
  if underscore_index && underscore_index.positive?
    composer = compact_text(without_number[0...underscore_index])
    work = compact_text(without_number[underscore_index..])
    return {
      composer: composer,
      work: work,
      answer: "#{composer} - #{work}",
    }
  end

  answer = compact_text(without_number)
  {
    composer: answer,
    work: "",
    answer: answer,
  }
end

def relative_url(folder_name, file_name)
  [folder_name, file_name].map { |part| URI.encode_www_form_component(utf8(part)).gsub("+", "%20") }.join("/")
end

directories = Dir.children(ROOT)
  .map { |entry| utf8(entry) }
  .select { |entry| ROOT.join(entry).directory? }
  .reject { |entry| IGNORED_DIRECTORIES.include?(entry) }
  .sort_by { |entry| [class_number(entry), entry.downcase] }

classes = directories.map do |directory|
  folder_path = ROOT.join(directory)
  audio_files = Dir.children(folder_path)
    .map { |entry| utf8(entry) }
    .select { |entry| folder_path.join(entry).file? }
    .select { |entry| AUDIO_EXTENSIONS.include?(File.extname(entry).downcase) }
    .sort_by { |entry| entry.downcase }

  {
    id: class_id(directory),
    label: class_label(directory),
    folder: utf8(directory).strip,
    tracks: audio_files.each_with_index.map do |file_name, index|
      {
        id: "#{class_id(directory)}-#{format('%02d', index + 1)}",
        fileName: utf8(file_name),
        src: relative_url(directory, file_name),
      }.merge(parse_track_title(file_name))
    end,
  }
end

OUTPUT_FILE.write("window.LISTENING_TEST_LIBRARY = #{JSON.pretty_generate(classes)};\n")

total_tracks = classes.sum { |item| item[:tracks].length }
puts "Generated #{OUTPUT_FILE.relative_path_from(ROOT)} with #{total_tracks} tracks."
