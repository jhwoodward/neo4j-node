import _ from 'lodash';
import utils from './utils';
import cypher from './cypher';

const api = {
    // options
    // format=compact
  configure : (image, options) => {

    if (options && options.thumbWidth) {
      options.thumbWidth = parseInt(options.thumbWidth);
    }
    const defaultOptions = { format: 'verbose', thumbWidth: 236 };
    options = Object.assign(defaultOptions, options);

    if (image) {

      image = utils.camelCase(image);

      var contentRoot = config.media.root;
      var isUpload = image.cache && image.cache.indexOf('upload/') === 0;

      image.thumb = {
        width: options.thumbWidth,
        height: parseInt(options.thumbWidth / (image.width / image.height))
      };
            // replace url/thumb with cached copy if present (?)
      if (image.cache) {
        image.thumb.url = contentRoot + 'thumbnail/' + image.cache.replace(/ /g, '%20');
        image.url = contentRoot + 'original/' + image.cache.replace(/ /g, '%20');
      }

      if (image.cacheHigh) {
        image.high = {
          url:contentRoot + 'original/' + image.cacheHigh.replace(/ /g, '%20')
        };
      }

        // Set source info
      if (isUpload) {
        image.source = {
          name: image.cache.replace('upload/', '').substring(0, image.cache.replace('upload/', '').indexOf('/')),
          ref: undefined
        };
      }
      else {
        image.source = {
          name: image.site,
          ref: image.ref || 'http://' + image.site,
          url: image.url
        };
      }

      delete image.cache;
      delete image.site;

        // Map properties to .full
      image.full = {
        url: image.url,
        width: image.width,
        height: image.height
      };

      delete image.url;
      delete image.width;
      delete image.height;

      delete image.cacheHigh;
      delete image.urlCaptured;
      delete image.ref;
      delete image.site;
    }
    return image;
  }
    ,
    // TODO: move cacheError label to image
  error: (data) => {
    const q = 'match (p:Picture) where ID(p)=' + data.pictureId + ' set p:NotFound';
    return cypher.executeQuery(q);
  }
};


export default api;






