set :css_dir, 'stylesheets'

set :js_dir, 'javascripts'

set :images_dir, 'images'

activate :relative_assets

configure :build do
  activate :minify_css
end
